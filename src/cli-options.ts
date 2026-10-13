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
  -h, --help             Affiche cette aide

Dans l'application:
  Espace  pause/reprise     O  options     H  aide     Q  quitter
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
  const options: AppOptions = {...DEFAULT_OPTIONS};
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    switch (argument) {
      case '--demo':
        options.demo = true;
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
