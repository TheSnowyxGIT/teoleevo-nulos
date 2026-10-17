import type {AppOptions, VisualizerController} from '../types.js';
import {findNestDropRenderer, NestDropVisualizer} from './nestdrop-visualizer.js';
import {ProjectMVisualizer} from './projectm-visualizer.js';

export function createVisualizer(options: AppOptions): VisualizerController {
  const nestDropRenderer = findNestDropRenderer(
    options.presetDirectory,
    options.nestDropRendererPath,
  );
  if (nestDropRenderer) {
    return new NestDropVisualizer({
      rendererPath: nestDropRenderer,
      settings: options.visualizerSettings,
    });
  }
  return new ProjectMVisualizer({
    rendererPath: options.rendererPath,
    textureDirectory: options.textureDirectory,
    settings: options.visualizerSettings,
  });
}
