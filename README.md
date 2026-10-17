# Teoleevo

Visualiseur et contrôleur de l’audio système Windows en temps réel. L’interface
[Ink](https://github.com/vadimdemedes/ink) affiche l’énergie des basses,
médiums et aigus, permet de chercher des presets MilkDrop `.milk`, puis affiche
leur rendu musical en plein écran sur le moniteur choisi.

Les presets sont sélectionnés manuellement depuis le terminal et restent
pilotables sans interrompre le moteur de rendu.

## Fonctionnalités

- capture de la sortie Windows par WASAPI loopback, sans « Stereo Mix » ;
- sélection à chaud parmi les sorties audio actives ;
- analyse FFT en trois bandes : 20–250 Hz, 250 Hz–4 kHz et 4–16 kHz ;
- niveau en dBFS, vumètres lissés et historique en direct ;
- rendu Ink limité indépendamment de l'analyse audio pour rester réactif ;
- options interactives pour la sortie, la réactivité et l’échelle ;
- contrôleur Chrome local synchronisé avec Ink sur `http://127.0.0.1:4317` ;
- télécommande Telegram optionnelle par boutons, sans port Internet entrant ;
- catalogue récursif, recherche instantanée et filtres de tags dans les presets `.milk` ;
- quatre playlists système par tag et playlists personnalisées éditables ;
- copie et fusion de playlists avec sauvegarde automatique des préférences ;
- lecture automatique configurable et mode aléatoire sans répétition par cycle ;
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

Ouvrez ensuite `http://127.0.0.1:4317` dans Chrome. L’interface web et Ink
contrôlent le même moteur : niveaux audio, presets, playlists et leur édition,
sorties audio/vidéo, plein écran, auto-switch et réglages MilkDrop restent
synchronisés. Le serveur écoute uniquement sur la machine locale. Utilisez
`--no-web` pour le désactiver ou `--web-port <port>` pour changer son port.

## Télécommande Telegram optionnelle

Créez un bot avec `@BotFather`, puis copiez le fichier d’exemple local :

```powershell
Copy-Item .env.example .env
```

Placez uniquement le token dans `.env`, lancez Teoleevo, puis envoyez `/start`
au bot. Il répond avec votre chat ID sans exécuter de commande. Ajoutez cet ID
et redémarrez l’application :

```dotenv
TEOLEEVO_TELEGRAM_TOKEN=123456:token-du-bot
TEOLEEVO_TELEGRAM_CHAT_ID=123456789
```

Le bot accepte `/next` et `/sound [chime|impact|airhorn]` depuis le chat autorisé
et envoie un panneau avec les boutons preset précédent/suivant, pause/reprise,
moteur, plein écran, auto-switch, shuffle et effets sonores. Ces effets sont
générés localement, sans fichiers audio, et restent exclusivement accessibles
dans Telegram : aucun contrôle n’est ajouté à Ink ou à l’interface web. Les
autres messages texte ne pilotent jamais l’application. Le chat ID est vérifié
sur chaque commande et chaque clic. Les anciennes commandes sont ignorées au
démarrage et les problèmes Telegram n’interrompent pas Ink, Chrome, l’audio ou
le visualiseur. `.env` est exclu de Git.
Si une valeur Telegram manque dans `.env`, l’application la complète depuis
`.env.example` comme configuration de secours.

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
`Entrée`. La fenêtre de preview `Deck 1` reste ouverte pendant toute la session.
Choisissez ensuite le moniteur dans `O` et utilisez `F` pour afficher ou masquer
la sortie plein écran indépendante. La résolution de rendu interne reprend
automatiquement la largeur et la hauteur de ce moniteur afin de conserver son
ratio, y compris en 21:9. Les presets suivants sont chargés dans le même moteur.

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
| `L` | Choisir ou gérer les playlists |
| `P` | Chercher et sélectionner un preset `.milk` |
| `T` | Activer ou désactiver rapidement l’auto-switch |
| `Tab` | Changer le filtre de tag dans le sélecteur de presets |
| `V` | Démarrer ou arrêter le moteur et sa fenêtre de preview |
| `F` | Afficher ou masquer la sortie plein écran |
| `N` / `B` | Preset suivant / précédent |
| `D` | Sortie audio suivante |
| `S` | Réactivité suivante |
| `H` | Aide |
| `Q` ou `Échap` | Quitter proprement |

Dans les options, utilisez les flèches haut/bas pour choisir une ligne et les
flèches gauche/droite pour modifier sa valeur.

Le renderer NestDrop garde sa fenêtre de preview `Deck 1` visible. Dans `O`,
choisissez `Écran de sortie`, puis activez `Plein écran`, ou utilisez directement
`F`. Cette commande concerne uniquement la seconde fenêtre de sortie : elle ne
ferme et ne masque jamais la preview. Si le nouvel écran utilise une autre
résolution, la Deck redémarre automatiquement avec le même preset pour que
NestDrop recalcule le ratio du rendu.

Dans le sélecteur de presets (`P`), `Tab` fait défiler les filtres `Tous`,
`Build-up`, `Drop`, `Verse` et `Other`. Ces tags servent uniquement au classement
manuel : ils ne déclenchent aucune détection ni aucun changement automatique.
La recherche textuelle s’applique en même temps que le filtre. Les touches `N`
et `B` passent directement au preset suivant ou précédent.

## Playlists

Utilisez `L` pour ouvrir le gestionnaire. Quatre playlists système sont générées
automatiquement depuis les tags : `Build-up`, `Drop`, `Verse` et `Other`. Elles
sont en lecture seule afin que le classement de base reste toujours disponible.
`Entrée` ouvre le détail de la playlist sélectionnée et `A` l’active. Ensuite,
`N` et `B` utilisent uniquement ses presets. Le sélecteur `P` continue de
chercher dans le catalogue complet pour permettre d’ouvrir directement
n’importe quel preset.

Dans le gestionnaire :

- `N` crée une playlist vide ;
- `C` copie la playlist sélectionnée, y compris une playlist système ;
- `M` ouvre une sélection multiple : `Espace` coche autant de playlists que
  nécessaire, puis `Entrée` crée leur union sans doublons ;
- `R` renomme et `D` supprime une playlist personnalisée.

Dans le détail d’une playlist, `Entrée` lance le preset sélectionné et `A`
active la playlist. Pour une playlist personnalisée, `X` retire un preset et
`Tab` ouvre le catalogue d’ajout/retrait. Les playlists système proposent le
même écran de consultation, mais restent en lecture seule.

L’écran principal affiche la file de lecture. Lorsqu’un preset choisi avec `P`
n’appartient pas à la playlist active, il apparaît dans une section prioritaire
temporaire. Le prochain appui sur `N` reprend ensuite au début de la playlist
active.

## Lecture automatique

La touche `T` active ou désactive rapidement l’auto-switch. Il est désactivé au
premier lancement et son intervalle par défaut est de 4 secondes. Les options
`O` permettent de régler l’intervalle, d’activer l’auto-switch et de choisir
entre l’ordre séquentiel et l’ordre aléatoire.

En mode séquentiel, la lecture revient au premier preset après le dernier. En
mode aléatoire, l’application génère un cycle contenant chaque preset une seule
fois. Un nouveau mélange n’est créé qu’après épuisement complet du cycle, sans
répéter immédiatement le dernier preset du cycle précédent. La file et le
compte à rebours restent visibles sur l’écran principal.

Le compte à rebours avance uniquement lorsqu’un signal audio est présent. Si
la musique est arrêtée, avant qu’elle commence ou pendant une pause manuelle,
le temps restant est conservé puis reprend au retour du son.

Les playlists personnalisées, la playlist active, le filtre de tag, la sortie
audio, l’écran sélectionné, la lecture automatique et les options visuelles sont sauvegardés
automatiquement. Les quatre playlists système ne sont pas écrites dans le
fichier : elles sont reconstruites depuis les tags à chaque lancement. Sous WSL
et Linux, les réglages sont stockés dans
`~/.config/teoleevo/settings.json`; sous Windows, dans
`%APPDATA%\Teoleevo\settings.json`. La variable `TEOLEEVO_CONFIG_PATH` permet
de choisir un autre fichier.

Le chemin de NestDrop peut être défini une seule fois avec le dossier racine de
l'installation. Il est validé puis sauvegardé avec les autres réglages :

```powershell
pnpm dev:audio -- --nestdrop-dir "D:\Applications\NestDropClassicV2x2"
```

Aux lancements suivants, `pnpm dev:audio` suffit. On peut aussi utiliser la
variable `TEOLEEVO_NESTDROP_DIR`. Un nouvel argument `--nestdrop-dir` est
prioritaire sur la valeur mémorisée. Le dossier doit conserver la structure
originale de NestDrop, notamment `Plugins\Milkdrop2\Presets`,
`Plugins\Milkdrop2\Textures` et `Plugins\NestDrop_SpoutSender.exe`.

## Options de ligne de commande

```text
--demo                 signal musical simulé
--device <id>          identifiant d’une sortie Windows
--fft-size <taille>    1024, 2048 ou 4096
--fps <nombre>         de 10 à 60
--ui-fps <nombre>      rafraîchissement du terminal de 5 à 30 (défaut 10)
--web-port <nombre>    port du contrôleur Chrome (défaut 4317)
--no-web               désactive le contrôleur localhost
--floor <dB>           plancher visuel de -100 à -30 dB
--helper <chemin>      chemin explicite vers AudioCapture.exe
--nestdrop-dir <chemin> dossier racine de NestDropClassicV2x2 (mémorisé)
--preset-dir <chemin>  dossier de presets .milk
--texture-dir <chemin> dossier des textures MilkDrop
--renderer <chemin>    chemin vers Visualizer.exe ou Visualizer.dll
--nestdrop-renderer <chemin> chemin vers NestDrop_SpoutSender.exe
--visual-speed <ratio> vitesse MilkDrop, de 0 à 2 (défaut 1.07175)
--visual-fps <nombre>  framerate de la fenêtre, de 10 à 120 (défaut 60)
--visual-volume <ratio> réaction audio visuelle, de 0 à 1 (défaut 1)
```

`pnpm dev:audio --help` affiche la liste complète.

## Architecture

```text
WASAPI → helper C# → FFT basses/médiums/aigus → interface Ink

périphérique sélectionné → NestDrop_SpoutSender → MilkDrop 2 / DirectX
                                      ↑
                  registre Deck1 : preset et réglages
                                      ├→ preview Deck 1 toujours visible
                                      └→ plein écran sur le moniteur choisi

Si NestDrop est absent : périphérique → Visualizer → NAudio → libprojectM.
```

Le helper d’analyse transmet à Node les trois bandes en dB via des lignes JSON.
Ce chemin n’utilise pas le microphone : il suit exactement la sortie choisie
dans l’interface.

Le renderer NestDrop reçoit le nom exact de la sortie WASAPI et lit les réglages
du deck dans le registre Windows. Le contrôleur TypeScript expose
`showPreset(preset)` sans recréer le processus, conserve sa fenêtre de preview et
pilote séparément la sortie plein écran. Les changements manuels appellent
`showPreset` avec le preset choisi sans changer de source audio ni d’écran.

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
