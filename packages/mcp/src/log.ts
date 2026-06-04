/**
 * Minimal stderr logger. stdout belongs to the stdio MCP protocol — writing
 * anything else there corrupts the framing — so every log path goes through
 * console.error.
 */

export type LogLevel = 'debug' | 'info' | 'silent';

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, silent: 99 };

export function createLogger(level: LogLevel): Logger {
  const rank = LEVEL_RANK[level];
  const emit = (label: string, labelRank: number, args: unknown[]): void => {
    if (labelRank < rank || rank === 99) return;
    // eslint-disable-next-line no-console
    console.error('[angflow-mcp]', `${label}:`, ...args);
  };
  return {
    debug: (...args) => emit('debug', 0, args),
    info: (...args) => emit('info', 1, args),
    warn: (...args) => emit('warn', 1, args),
  };
}
