#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tools_root="$project_root/.tools"
uv_root="$tools_root/uv"
beatnet_root="$tools_root/BeatNet"
venv_root="$tools_root/beatnet-venv"

mkdir -p "$tools_root"
if [[ ! -x "$uv_root/uv" ]]; then
  curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR="$uv_root" sh
fi

if [[ ! -d "$beatnet_root/.git" ]]; then
  git clone https://github.com/mjhydri/BeatNet.git "$beatnet_root"
fi
git -C "$beatnet_root" -c advice.detachedHead=false checkout --detach --quiet \
  81cedd4beeb7235262db80969a0c9ce9a48a0ed4

if [[ ! -x "$venv_root/bin/python" ]]; then
  "$uv_root/uv" venv --python 3.11 "$venv_root"
fi
"$uv_root/uv" pip install --python "$venv_root/bin/python" \
  'numpy==1.26.4' 'cython<3' 'setuptools<70' wheel
"$uv_root/uv" pip install --python "$venv_root/bin/python" \
  'torch==2.14.1' --index-url https://download.pytorch.org/whl/cpu
"$uv_root/uv" pip install --python "$venv_root/bin/python" \
  'scipy==1.13.1' 'librosa==0.10.2.post1' 'matplotlib==3.10.7' \
  'mido==1.3.3' 'pyyaml==6.0.3'
"$uv_root/uv" pip install --python "$venv_root/bin/python" \
  --no-build-isolation --no-deps --reinstall \
  'git+https://github.com/CPJKU/madmom.git@27f032e8947204902c675e5e341a3faf5dc86dae'

PYTHONDONTWRITEBYTECODE=1 "$venv_root/bin/python" -c \
  'import madmom, numpy, torch; print(f"BeatNet prêt · NumPy {numpy.__version__} · PyTorch {torch.__version__}")'
