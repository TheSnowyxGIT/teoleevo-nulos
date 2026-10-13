# Teoleevo

Visualiseur de l’audio système Windows en temps réel, directement dans le
terminal. L’interface [Ink](https://github.com/vadimdemedes/ink) affiche
l’énergie des basses, médiums et aigus avec des vumètres et un historique.

Cette première version se concentre sur une mesure stable et observable. Elle
n’envoie aucune touche clavier.

## Fonctionnalités

- capture de la sortie Windows par WASAPI loopback, sans « Stereo Mix » ;
- sélection à chaud parmi les sorties audio actives ;
- analyse FFT en trois bandes : 20–250 Hz, 250 Hz–4 kHz et 4–16 kHz ;
- niveau en dBFS, vumètres lissés et historique en direct ;
- options interactives pour la sortie, la réactivité et l’échelle ;
- mode démo sans audio, utilisable sous Linux, macOS ou en CI ;
- prise en charge de Windows Terminal et de WSL avec interop Windows.

## Prérequis

- Node.js 20 ou plus récent ;
- pnpm 11 ;
- SDK .NET 7 ou plus récent côté Windows.

La capture ne demande normalement ni permission microphone ni droits
administrateur : WASAPI lit le mix de la sortie audio sélectionnée.

## Installation et lancement

Depuis PowerShell Windows :

```powershell
pnpm install
pnpm helper:build
pnpm dev:audio
```

Depuis WSL, le projet peut employer le SDK .NET installé sur Windows :

```bash
pnpm install
pnpm helper:build:wsl
pnpm dev:audio
```

Pour tester seulement l’interface avec un signal simulé :

```bash
pnpm demo
```

Pour construire puis exécuter la version JavaScript compilée :

```bash
pnpm build
pnpm start
```

## Contrôles

| Touche | Action |
| --- | --- |
| `Espace` | Pause/reprise de l’affichage |
| `O` | Options interactives |
| `D` | Sortie audio suivante |
| `S` | Réactivité suivante |
| `H` | Aide |
| `Q` ou `Échap` | Quitter proprement |

Dans les options, utilisez les flèches haut/bas pour choisir une ligne et les
flèches gauche/droite pour modifier sa valeur.

## Options de ligne de commande

```text
--demo                 signal musical simulé
--device <id>          identifiant d’une sortie Windows
--fft-size <taille>    1024, 2048 ou 4096
--fps <nombre>         de 10 à 60
--floor <dB>           plancher visuel de -100 à -30 dB
--helper <chemin>      chemin explicite vers AudioCapture.exe
```

`pnpm dev:audio -- --help` affiche la liste complète.

## Architecture

Le helper C# capture et analyse le signal sur un thread audio. Il transmet à
Node uniquement trois valeurs en dB via des lignes JSON ; aucun PCM brut ne
traverse le processus. L’interface TypeScript gère le rendu, le lissage, les
options et le cycle de vie du helper. Cette séparation permettra d’ajouter plus
tard les règles et les actions clavier sans coupler celles-ci à WASAPI.

## Vérifications

```bash
pnpm check
pnpm test
pnpm build
```
