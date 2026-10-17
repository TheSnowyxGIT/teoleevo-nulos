#!/usr/bin/env python3
"""Streaming adapter around BeatNet's causal CRNN and particle filter.

stdin receives raw float32 mono hops (441 samples at 22.05 kHz). stdout is
newline-delimited JSON; diagnostics go to stderr so the Node protocol remains
machine-readable.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
import torch

SAMPLE_RATE = 22_050
HOP_SAMPLES = 441
HOP_BYTES = HOP_SAMPLES * 4
HOP_SECONDS = HOP_SAMPLES / SAMPLE_RATE


def emit(message: dict[str, object]) -> None:
    print(json.dumps(message, separators=(",", ":")), flush=True)


def read_exact(size: int) -> bytes | None:
    chunks: list[bytes] = []
    remaining = size
    while remaining:
        chunk = sys.stdin.buffer.read(remaining)
        if not chunk:
            return None
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--beatnet-root", type=Path, required=True)
    parser.add_argument("--model", type=int, choices=(1, 2, 3), default=1)
    arguments = parser.parse_args()

    source = arguments.beatnet_root / "src"
    sys.path.insert(0, str(source))
    from BeatNet.log_spect import LOG_SPECT
    from BeatNet.model import BDA
    from BeatNet.particle_filtering_cascade import particle_filter_cascade

    torch.set_num_threads(2)
    device = "cpu"
    model = BDA(272, 150, 2, device)
    weights = (
        source
        / "BeatNet"
        / "models"
        / f"model_{arguments.model}_weights.pt"
    )
    model.load_state_dict(
        torch.load(weights, map_location=device, weights_only=True), strict=False
    )
    model.eval()

    window_length = int(64 * 0.001 * SAMPLE_RATE) + 2 * HOP_SAMPLES
    window = np.zeros(window_length, dtype=np.float32)
    features = LOG_SPECT(
        sample_rate=SAMPLE_RATE,
        win_length=int(64 * 0.001 * SAMPLE_RATE),
        hop_size=HOP_SAMPLES,
        n_bands=[24],
        mode="stream",
    )
    estimator = particle_filter_cascade(
        beats_per_bar=[], fps=50, plot=[], mode="worker"
    )

    frame = 0
    path_length = 0
    beat_position = 0
    meter = 4
    beats_this_bar = 0
    beat_times: deque[float] = deque(maxlen=10)
    bpm: float | None = None
    emit({"type": "ready", "backend": "BeatNet", "sampleRate": SAMPLE_RATE})

    while True:
        payload = read_exact(HOP_BYTES)
        if payload is None:
            break
        hop = np.frombuffer(payload, dtype="<f4")
        window[:-HOP_SAMPLES] = window[HOP_SAMPLES:]
        window[-HOP_SAMPLES:] = hop

        if frame < 5:
            prediction = np.zeros((1, 2), dtype=np.float32)
        else:
            extracted = features.process_audio(window).T[-1]
            tensor = torch.from_numpy(extracted).unsqueeze(0).unsqueeze(0)
            with torch.no_grad():
                raw = model(tensor)[0]
                prediction = np.transpose(model.final_pred(raw).numpy()[:2, :])

        path = estimator.process(prediction)
        beat = False
        downbeat = False
        if len(path) > path_length:
            event_time, event_kind = path[-1]
            beat = True
            downbeat = int(event_kind) == 1
            if downbeat:
                if 2 <= beats_this_bar <= 4:
                    meter = beats_this_bar
                beats_this_bar = 1
                beat_position = 1
            else:
                beats_this_bar += 1
                beat_position = max(2, min(meter, beat_position + 1))
            beat_times.append(float(event_time))
            if len(beat_times) >= 4:
                intervals = np.diff(np.asarray(beat_times))
                intervals = intervals[(intervals >= 0.28) & (intervals <= 1.1)]
                if len(intervals):
                    bpm = float(60 / np.median(intervals))
            path_length = len(path)

        if beat or frame % 5 == 0:
            emit(
                {
                    "type": "rhythm",
                    "streamTime": round(frame * HOP_SECONDS, 3),
                    "beat": beat,
                    "downbeat": downbeat,
                    "beatPosition": beat_position or None,
                    "meter": meter,
                    "bpm": round(bpm, 1) if bpm else None,
                    "beatActivation": round(float(prediction[0, 0]), 4),
                    "downbeatActivation": round(float(prediction[0, 1]), 4),
                }
            )
        frame += 1


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        emit({"type": "error", "message": str(error)})
        raise
