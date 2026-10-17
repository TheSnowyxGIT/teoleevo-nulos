import {DEFAULT_OPTIONS} from './config.js';
import type {AppOptions} from './types.js';

export const HELP_TEXT = `
Teoleevo — visualiseur audio système en direct

Usage:
  teoleevo [options]

Options:
  --demo                 Utilise un signal musical simulé
  --device <id>          Sélectionne une sortie audio Windows
  --fft-size <taille>    1024, 2048 (défaut) ou 4096
  --fps <nombre>         Rafraîchissement entre 10 et 60 (défaut: 30)
  --floor <dB>           Plancher des vumètres, de -100 à -30 (défaut: -70)
  --helper <chemin>      Chemin explicite vers AudioCapture.exe
  --preset-dir <chemin>  Dossier de presets .milk (recherche récursive)
  --texture-dir <chemin> Dossier de textures MilkDrop
  --renderer <chemin>    Chemin explicite vers Visualizer.exe/.dll
  --nestdrop-renderer <chemin> Chemin vers NestDrop_SpoutSender.exe
  --visual-speed <ratio> Vitesse MilkDrop, de 0 à 2 (défaut: 1.07175)
  --visual-fps <nombre>  Images/s de la fenêtre, de 10 à 120 (défaut: 30)
  --visual-volume <ratio> Réaction audio visuelle, de 0 à 1 (défaut: 1)
  --no-beatnet           Désactive le suivi neuronal beat/downbeat
  --auto-drop            Active le changement de preset sur les drops
  --no-auto-drop         Force sa désactivation
  -h, --help             Affiche cette aide

Dans l'application:
  P  presets     V  moteur visuel     F  plein écran     O  options     Q  quitter
`;

export interface ParsedCli {
  options: AppOptions;
  help: boolean;
}

function readValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Valeur manquante pour ${flag}`);
  }

  return value;
}

export function parseCli(args: string[]): ParsedCli {
  const options: AppOptions = {
    ...DEFAULT_OPTIONS,
    visualizerSettings: {...DEFAULT_OPTIONS.visualizerSettings},
  };
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    switch (argument) {
      case '--demo':
        options.demo = true;
        break;
      case '--no-beatnet':
        options.beatNet = false;
        break;
      case '--no-auto-drop':
        options.autoDropPresets = false;
        break;
      case '--auto-drop':
        options.autoDropPresets = true;
        break;
      case '--device':
        options.deviceId = readValue(args, index, argument);
        index += 1;
        break;
      case '--fft-size': {
        const value = Number(readValue(args, index, argument));
        if (value !== 1024 && value !== 2048 && value !== 4096) {
          throw new Error('--fft-size doit valoir 1024, 2048 ou 4096');
        }
        options.fftSize = value;
        index += 1;
        break;
      }
      case '--fps': {
        const value = Number(readValue(args, index, argument));
        if (!Number.isInteger(value) || value < 10 || value > 60) {
          throw new Error('--fps doit être un entier entre 10 et 60');
        }
        options.fps = value;
        index += 1;
        break;
      }
      case '--floor': {
        const value = Number(readValue(args, index, argument));
        if (!Number.isFinite(value) || value < -100 || value > -30) {
          throw new Error('--floor doit être compris entre -100 et -30 dB');
        }
        options.meterFloor = value;
        index += 1;
        break;
      }
      case '--helper':
        options.helperPath = readValue(args, index, argument);
        index += 1;
        break;
      case '--preset-dir':
        options.presetDirectory = readValue(args, index, argument);
        index += 1;
        break;
      case '--texture-dir':
        options.textureDirectory = readValue(args, index, argument);
        index += 1;
        break;
      case '--renderer':
        options.rendererPath = readValue(args, index, argument);
        index += 1;
        break;
      case '--nestdrop-renderer':
        options.nestDropRendererPath = readValue(args, index, argument);
        index += 1;
        break;
      case '--visual-speed': {
        const value = Number(readValue(args, index, argument));
        if (!Number.isFinite(value) || value < 0 || value > 2) {
          throw new Error('--visual-speed doit être compris entre 0 et 2');
        }
        options.visualizerSettings.speed = value;
        index += 1;
        break;
      }
      case '--visual-fps': {
        const value = Number(readValue(args, index, argument));
        if (!Number.isInteger(value) || value < 10 || value > 120) {
          throw new Error('--visual-fps doit être un entier entre 10 et 120');
        }
        options.visualizerSettings.frameRate = value;
        index += 1;
        break;
      }
      case '--visual-volume': {
        const value = Number(readValue(args, index, argument));
        if (!Number.isFinite(value) || value < 0 || value > 1) {
          throw new Error('--visual-volume doit être compris entre 0 et 1');
        }
        options.visualizerSettings.audioGain = value;
        index += 1;
        break;
      }
      case '-h':
      case '--help':
        help = true;
        break;
      default:
        throw new Error(`Option inconnue: ${argument ?? ''}`);
    }
  }

  return {options, help};
}
