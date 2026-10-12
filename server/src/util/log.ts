/** Minimal console logger with a scope prefix; the console window is the operator's log. */
export function createLogger(scope: string) {
  const fmt = (level: string, msg: string) =>
    `${new Date().toLocaleTimeString('uk-UA', { hour12: false })} ${level} [${scope}] ${msg}`;
  return {
    info: (msg: string) => console.log(fmt('INF', msg)),
    warn: (msg: string) => console.warn(fmt('WRN', msg)),
    error: (msg: string) => console.error(fmt('ERR', msg)),
  };
}

export type Logger = ReturnType<typeof createLogger>;
