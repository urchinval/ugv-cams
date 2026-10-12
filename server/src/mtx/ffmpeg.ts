import { existsSync } from 'node:fs';

/**
 * Executable token for MediaMTX runOnDemand commands.
 *
 * MediaMTX on Windows does not use a shell: it substitutes $VARS itself and splits the
 * command with POSIX-style quoting, where an unquoted backslash is an escape character.
 * So the path is written with forward slashes inside single quotes — valid for
 * CreateProcess on Windows and for /bin/sh on Linux.
 */
export function ffmpegCommandToken(bundledPath: string): { token: string; found: boolean } {
  if (existsSync(bundledPath)) {
    return { token: `'${bundledPath.replaceAll('\\', '/')}'`, found: true };
  }
  // fall back to PATH; MediaMTX will log an error per attempt if it is not there either
  return { token: 'ffmpeg', found: false };
}
