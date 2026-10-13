import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';

export const isWsl =
  process.platform === 'linux' &&
  (Boolean(process.env['WSL_DISTRO_NAME']) || existsSync('/proc/sys/fs/binfmt_misc/WSLInterop'));

const WINDOWS_ABSOLUTE_PATH = /^[a-zA-Z]:[\\/]/;

export function toLocalPath(input: string): string {
  if (!isWsl || !WINDOWS_ABSOLUTE_PATH.test(input)) return input;

  return execFileSync('wslpath', ['-u', input], {encoding: 'utf8'}).trim();
}

export function toWindowsPath(input: string): string {
  if (!isWsl) return input;

  return execFileSync('wslpath', ['-w', input], {encoding: 'utf8'}).trim();
}
