# Teoleevo

Visualiseur et contrôleur de l’audio système Windows en temps réel. L’interface
[Ink](https://github.com/vadimdemedes/ink) affiche l’énergie des basses,
médiums et aigus, permet de chercher des presets MilkDrop `.milk`, puis affiche
leur rendu musical en plein écran sur le moniteur choisi.

Cette version utilise les beats et downbeats comme grille musicale, détecte les
transitions principales en direct et peut passer automatiquement au preset
suivant lorsqu’un drop est confirmé.

## Fonctionnalités

- capture de la sortie Windows par WASAPI loopback, sans « Stereo Mix » ;
- sélection à chaud parmi les sorties audio actives ;
- analyse FFT en trois bandes : 20–250 Hz, 250 Hz–4 kHz et 4–16 kHz ;
- extraction de la puissance, du sub-bass, de la brillance et du flux spectral ;
- suivi neuronal en direct des beats, downbeats et du BPM avec
  [BeatNet](https://github.com/mjhydri/BeatNet) ;
- détection par mesure des build-ups, drops et breakdowns ;
- changement automatique de preset sur le début d’un drop ;
- niveau en dBFS, vumètres lissés et historique en direct ;
- options interactives pour la sortie, la réactivité et l’échelle ;
- catalogue récursif et recherche instantanée dans les presets `.milk` ;
- preview moteur persistante et sortie plein écran sélectionnable par moniteur ;
- vitesse globale, volume de réaction musicale et framerate réglables à chaud ;
- rendu MilkDrop 2 natif via NestDrop, avec libprojectM comme solution de repli ;
- mode démo sans audio, utilisable sous Linux, macOS ou en CI ;
- prise en charge de Windows Terminal et de WSL avec interop Windows.

## Prérequis

- Node.js 20 ou plus récent ;
- pnpm 11 ;
- SDK .NET 7 ou plus récent côté Windows.
- le runtime libprojectM, installable avec la commande fournie ci-dessous ;
- pour BeatNet sous WSL : `bash`, `curl` et environ 2 Go libres pour Python,
  PyTorch CPU et les dépendances.

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
pnpm beatnet:install
pnpm dev:audio
```

`beatnet:install` crée un Python 3.11 isolé et récupère une révision figée de
BeatNet dans `.tools/`, dossier ignoré par Git. L’application utilise le modèle
sur CPU : aucun CUDA ni GPU NVIDIA n’est requis. Cet installateur vise
actuellement WSL/Linux ; la capture et la fenêtre MilkDrop restent des processus
Windows.

L’installeur extrait les DLL officielles libprojectM/SDL et leurs textures dans
`.tools/projectm` (ignoré par Git). L’hôte `native/Visualizer` reste notre code
et communique avec Ink par JSON sur stdin/stdout. Aucun fichier de NestDrop
n’est copié dans le dépôt. Au démarrage, Teoleevo détecte automatiquement le
dossier suivant s’il existe :

```text
Downloads/NestDropClassicV2x2/Plugins/Milkdrop2/Presets
```

Appuyez sur `P`, tapez une partie du nom, sélectionnez avec `↑`/`↓`, puis
`Entrée`. La fenêtre de preview `Deck 1` reste ouverte pendant toute la session.
Choisissez ensuite le moniteur dans `O` et utilisez `F` pour afficher ou masquer
la sortie plein écran indépendante. Les presets suivants sont chargés dans le
même moteur.

Le panneau `BEATNET` indique uniquement l’état du moteur rythmique, ses
activations, le BPM et la position dans la mesure. Le panneau `ÉVÉNEMENT
MUSICAL` est distinct : après trois mesures d’apprentissage, il affiche
`NEUTRE`, `BUILD-UP`, `DROP` ou `BREAKDOWN`, ainsi que les scores de drop,
d’impact, de retour des basses et de nouveauté.

La détection compare chaque beat et chaque mesure à l’historique récent. Un
drop demande un impact net, un retour des basses ou une nouveauté spectrale et
est privilégié sur un downbeat. L’événement `dropTriggered` n’est émis qu’une
fois, avec un cooldown de quatre mesures, tandis que `DROP` reste visible deux
mesures. Une hausse presque identique de toutes les bandes est reconnue comme
un changement de gain probable et pénalisée.

Le changement automatique est désactivé par défaut. Utilisez `A`, l’option
`Preset sur drop` ou `--auto-drop` pour l’activer. Il ne s’arme que lorsque la
moteur visuel est déjà démarré et qu’un preset existe.

Quand NestDrop est installé à côté du dossier de presets, son renderer MilkDrop 2
est utilisé automatiquement. La vitesse démarre à `1,07175×`, valeur relevée
dans `Profile Teo.xml` (`1×` est la vitesse normale), et la réaction audio à
`1×`. Les réglages sont envoyés au renderer natif sans modifier les fichiers
`.milk`. Changer de preset met à jour le moteur existant. Si le renderer
NestDrop est absent, libprojectM reste utilisé comme solution de repli.

Le réglage `FPS / fluidité` plafonne le nombre d’images calculées par seconde et
transmet cette valeur aux équations MilkDrop. Il ne constitue pas un contrôle de
vitesse fiable : une animation basée sur le temps réel garde la même durée à 30
ou 60 FPS, mais paraît plus fluide à 60 FPS.

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
| `Tab` | Changer le filtre de tag dans le sélecteur de presets |
| `V` | Démarrer ou arrêter le moteur et sa fenêtre de preview |
| `F` | Afficher ou masquer la sortie plein écran |
| `N` / `B` | Preset suivant / précédent |
| `D` | Sortie audio suivante |
| `S` | Réactivité suivante |
| `A` | Activer/désactiver le changement de preset sur drop |
| `H` | Aide |
| `Q` ou `Échap` | Quitter proprement |

Dans les options, utilisez les flèches haut/bas pour choisir une ligne et les
flèches gauche/droite pour modifier sa valeur.

Le renderer NestDrop garde sa fenêtre de preview `Deck 1` visible. Dans `O`,
choisissez `Écran de sortie`, puis activez `Plein écran`, ou utilisez directement
`F`. Cette commande concerne uniquement la seconde fenêtre de sortie : elle ne
ferme et ne masque jamais la preview.

Dans le sélecteur de presets (`P`), `Tab` fait défiler les filtres `Tous`,
`Build-up`, `Drop`, `Verse` et `Other`. La recherche textuelle s’applique en
même temps que le filtre. Un preset peut appartenir à plusieurs sections ; tous
les presets qui ne font pas partie de la sélection éditoriale sont classés
`Other`.

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
--nestdrop-renderer <chemin> chemin vers NestDrop_SpoutSender.exe
--visual-speed <ratio> vitesse MilkDrop, de 0 à 2 (défaut 1.07175)
--visual-fps <nombre>  framerate de la fenêtre, de 10 à 120 (défaut 30)
--visual-volume <ratio> réaction audio visuelle, de 0 à 1 (défaut 1)
--no-beatnet           désactive le suivi neuronal beat/downbeat
--auto-drop            active le changement de preset sur drop
--no-auto-drop         force sa désactivation
```

`pnpm dev:audio --help` affiche la liste complète.

## Architecture

```text
WASAPI → helper C# → FFT/features ─→ détecteur par mesure ─→ interface Ink
          │
          └→ mono 22,05 kHz → BeatNet → beat/downbeat/BPM ─┘       │
                                                                  └→ preset suivant

périphérique sélectionné → NestDrop_SpoutSender → MilkDrop 2 / DirectX
                                      ↑
                  registre Deck1 : preset et réglages
                                      ├→ preview Deck 1 toujours visible
                                      └→ plein écran sur le moniteur choisi

Si NestDrop est absent : périphérique → Visualizer → NAudio → libprojectM.
```

Le helper d’analyse transmet à Node les bandes en dB, la puissance, le
sub-bass, les bas/hauts médiums, le centroïde et le flux spectral via des lignes
JSON. Pour BeatNet, il convertit en parallèle le même flux stéréo 48 kHz en
mono 22,05 kHz, par blocs exacts de 20 ms. Le sidecar Python exécute le CRNN
causal et son filtre particulaire, puis renvoie les pulsations à Node. Ce chemin
n’utilise ni microphone ni PyAudio : il suit exactement la sortie choisie dans
l’interface.

Le renderer NestDrop reçoit le nom exact de la sortie WASAPI et lit les réglages
du deck dans le registre Windows. Le contrôleur TypeScript expose
`showPreset(preset)` sans recréer le processus, conserve sa fenêtre de preview et
pilote séparément la sortie plein écran. Le déclenchement unique du drop appelle
`showPreset` avec le preset suivant sans changer de source audio ni d’écran.

La distribution Windows [projectMSDL](https://github.com/projectM-visualizer/frontend-sdl-cpp)
fournit les DLL du moteur [libprojectM](https://github.com/projectM-visualizer/projectm),
deux projets tiers avec leurs propres licences. Leurs binaires et les presets
NestDrop ne font pas partie de Git. La compatibilité peut varier pour les
presets utilisant des shaders ou textures très spécifiques à MilkDrop 2.
BeatNet et ses modèles sont récupérés séparément sous licence CC BY 4.0 ; leur
code n’est pas copié dans ce dépôt.

## Vérifications

```bash
pnpm check
pnpm test
pnpm build
```
