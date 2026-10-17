const TELEGRAM_TOKEN = 'TEOLEEVO_TELEGRAM_TOKEN';
const TELEGRAM_CHAT_ID = 'TEOLEEVO_TELEGRAM_CHAT_ID';

export function loadLocalEnvironment(
  primaryPath = '.env',
  fallbackPath = '.env.example',
): void {
  clearEmptyTelegramVariables();
  loadEnvironmentFile(primaryPath);
  // Empty values from .env would otherwise prevent Node from applying each fallback.
  clearEmptyTelegramVariables();
  loadEnvironmentFile(fallbackPath);
}

function clearEmptyTelegramVariables(): void {
  for (const name of [TELEGRAM_TOKEN, TELEGRAM_CHAT_ID]) {
    if (!process.env[name]?.trim()) delete process.env[name];
  }
}

function loadEnvironmentFile(filePath: string): void {
  try {
    process.loadEnvFile(filePath);
  } catch {
    // Both files are optional; Telegram stays disabled when neither provides a token.
  }
}
