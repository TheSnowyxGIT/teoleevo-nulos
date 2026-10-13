import type {AppOptions, VisualizerController} from '../types.js';
import {ProjectMVisualizer} from './projectm-visualizer.js';

export function createVisualizer(options: AppOptions): VisualizerController {
  return new ProjectMVisualizer({
    rendererPath: options.rendererPath,
    textureDirectory: options.textureDirectory,
  });
}
