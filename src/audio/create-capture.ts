import {DemoCapture} from './demo-capture.js';
import {WindowsCapture} from './windows-capture.js';
import type {AppOptions, CaptureSource} from '../types.js';

export function createCapture(options: AppOptions): CaptureSource {
  if (options.demo) return new DemoCapture(options.fps, options.fftSize);
  return new WindowsCapture(options);
}
