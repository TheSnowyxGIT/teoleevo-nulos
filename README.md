# Teoleevo

Visualiseur et contrôleur de l’audio système Windows en temps réel. L’interface
[Ink](https://github.com/vadimdemedes/ink) affiche l’énergie des basses,
médiums et aigus, permet de chercher des presets MilkDrop `.milk`, puis ouvre
leur rendu musical dans une fenêtre GPU séparée.

Cette version n’envoie encore aucune touche clavier et n’applique aucune règle
de détection de drop.

## Fonctionnalités

- capture de la sortie Windows par WASAPI loopback, sans « Stereo Mix » ;
- sélection à chaud parmi les sorties audio actives ;
- analyse FFT en trois bandes : 20–250 Hz, 250 Hz–4 kHz et 4–16 kHz ;
- niveau en dBFS, vumètres lissés et historique en direct ;
- options interactives pour la sortie, la réactivité et l’échelle ;
- catalogue récursif et recherche instantanée dans les presets `.milk` ;
- lancement, arrêt et transition de preset dans une fenêtre persistante ;
- rendu MilkDrop musical via libprojectM et un hôte Windows contrôlé par IPC ;
- mode démo sans audio, utilisable sous Linux, macOS ou en CI ;
- prise en charge de Windows Terminal et de WSL avec interop Windows.

## Prérequis

- Node.js 20 ou plus récent ;
- pnpm 11 ;
- SDK .NET 7 ou plus récent côté Windows.
- le runtime libprojectM, installable avec la commande fournie ci-dessous.

La capture ne demande normalement ni permission microphone ni droits
administrateur : WASAPI lit le mix de la sortie audio sélectionnée.

## Installation et lancement

Depuis PowerShell Windows :

```powershell
pnpm install
pnpm helper:build
pnpm renderer:install
pnpm renderer:build
pnpm dev:audio
```

Depuis WSL, le projet peut employer le SDK .NET installé sur Windows :

```bash
pnpm install
pnpm helper:build:wsl
pnpm renderer:install:wsl
pnpm renderer:build:wsl
pnpm dev:audio
```

L’installeur extrait les DLL officielles libprojectM/SDL et leurs textures dans
`.tools/projectm` (ignoré par Git). L’hôte `native/Visualizer` reste notre code
et communique avec Ink par JSON sur stdin/stdout. Aucun fichier de NestDrop
n’est copié dans le dépôt. Au démarrage, Teoleevo détecte automatiquement le
dossier suivant s’il existe :

```text
Downloads/NestDropClassicV2x2/Plugins/Milkdrop2/Presets
```

Appuyez sur `P`, tapez une partie du nom, sélectionnez avec `↑`/`↓`, puis
`Entrée`. L’hôte ouvre une fenêtre Windows, capture par WASAPI la sortie
exactement sélectionnée dans Ink et transmet le PCM stéréo à libprojectM. Les
presets suivants sont chargés dans cette même fenêtre avec une transition.

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
| `P` | Chercher et sélectionner un preset `.milk` |
| `V` | Ouvrir ou fermer la fenêtre de visualisation |
| `N` / `B` | Preset suivant / précédent |
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
--preset-dir <chemin>  dossier de presets .milk
--texture-dir <chemin> dossier des textures MilkDrop
--renderer <chemin>    chemin vers Visualizer.exe ou Visualizer.dll
```

`pnpm dev:audio --help` affiche la liste complète.

## Architecture

```text
WASAPI → helper C# → bass/mids/treble → interface Ink → futures règles
          périphérique sélectionné ────────────────┐       ↓
                                                   └→ hôte Visualizer
PCM Windows → NAudio → libprojectM ← commandes preset → fenêtre OpenGL unique
```

Le helper d’analyse transmet à Node trois valeurs en dB via des lignes JSON.
L’hôte de visualisation reçoit l’identifiant exact de cette sortie, effectue sa
propre capture PCM WASAPI et alimente libprojectM. Le contrôleur TypeScript
expose `showPreset(preset)` : cette méthode démarre la fenêtre une seule fois,
puis lui envoie les presets suivants par IPC. Les futures règles de drop
appelleront donc la même méthode sans recréer la fenêtre ni changer de source
audio.

La distribution Windows [projectMSDL](https://github.com/projectM-visualizer/frontend-sdl-cpp)
fournit les DLL du moteur [libprojectM](https://github.com/projectM-visualizer/projectm),
deux projets tiers avec leurs propres licences. Leurs binaires et les presets
NestDrop ne font pas partie de Git. La compatibilité peut varier pour les
presets utilisant des shaders ou textures très spécifiques à MilkDrop 2.

## Vérifications

```bash
pnpm check
pnpm test
pnpm build
```
