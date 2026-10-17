# Windows 11 setup

## 1. Install the prerequisites

1. Install [Git for Windows](https://git-scm.com/download/win).
2. Install [Node.js 24 LTS (x64)](https://nodejs.org/en/download).
3. Install the [.NET 7 SDK (x64)](https://dotnet.microsoft.com/en-us/download/dotnet/7.0).
4. Open a new PowerShell window and install pnpm:

```powershell
npm install --global pnpm@11.23.0
```

## 2. Install NestDrop

1. Download your own copy of [NestDrop Classic V2x2](https://nestimmersion.ca/nestdrop.php).
2. Extract it outside `C:\Program Files`, for example to:

```text
C:\Tools\NestDropClassicV2x2
```

3. Install [Spout 2](https://github.com/leadedge/Spout2/releases), then run `SpoutSettings.exe` once.
4. Install the [DirectX End-User Runtimes (June 2010)](https://www.microsoft.com/en-us/download/details.aspx?id=8109). Extract the download and run `DXSETUP.exe`.
5. Run `NestDropClassic.exe` once, accept the Windows security prompts, then close it.

Keep the original NestDrop folder structure unchanged.

## 3. Install the application

In PowerShell:

```powershell
git clone https://github.com/OWNER/REPOSITORY.git
cd teoleevo-nulos
pnpm install --frozen-lockfile
pnpm helper:build
```

Replace the clone URL with the private repository URL.

## 4. First launch

Provide the NestDrop folder once:

```powershell
pnpm dev:audio -- --nestdrop-dir "C:\Tools\NestDropClassicV2x2"
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317) in Chrome to control the
same application from the browser.

The path is saved automatically. For every later launch, use:

```powershell
pnpm dev:audio
```

Press `P` to select a preset, `O` for options, `F` for fullscreen, and `Q` to quit.

If the terminal feels slow, open `O` and lower **FPS du terminal** to `5` or `8`.
This does not change MilkDrop's rendering FPS.

## Optional Telegram remote

Create a bot with `@BotFather`, then:

```powershell
Copy-Item .env.example .env
```

Put `TEOLEEVO_TELEGRAM_TOKEN=your-token` in `.env`, start Teoleevo, and send
`/start` to the bot. Copy the chat ID it replies with into `.env`:

```dotenv
TEOLEEVO_TELEGRAM_CHAT_ID=123456789
```

Restart Teoleevo. The private button panel is sent automatically. `/next`
selects the next preset; every other text command is ignored. `.env` is ignored
by Git. Missing Telegram values are loaded from `.env.example` as a fallback.
