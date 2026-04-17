/**
 * Reach Client Logger
 * Captures logs in-memory for export to GitHub issues.
 */

type LogLevel = 'log' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 2000;
  private originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  constructor() {
    this.init();
  }

  private init() {
    // Wrap console methods
    (Object.keys(this.originalConsole) as LogLevel[]).forEach((level) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (console as any)[level] = (...args: unknown[]) => {
        // Call original
        this.originalConsole[level].apply(console, args);

        // Capture
        const message = args
          .map((arg) => {
            if (typeof arg === 'object' && arg !== null) {
              try {
                // Scrub sensitive Matrix fields
                return JSON.stringify(arg, (key, value) => {
                  if (['access_token', 'password', 'recovery_key', 'private_key', 'token'].includes(key.toLowerCase())) {
                    return '[REDACTED]';
                  }
                  return value;
                });
              } catch {
                return '[Circular/Complex Object]';
              }
            }
            return String(arg);
          })
          .join(' ');

        this.addLog(level, message);
      };
    });
  }

  private addLog(level: LogLevel, message: string) {
    this.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
    });

    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }
  }

  public getLogs(): string {
    const systemInfo = [
      `App: Reach (Matrix Client)`,
      `User Agent: ${navigator.userAgent}`,
      `OS: ${navigator.platform}`,
      `Timestamp: ${new Date().toISOString()}`,
      `---------------------------------------`,
      '',
    ].join('\n');

    return systemInfo + this.logs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
  }

  public downloadLogs() {
    const blob = new Blob([this.getLogs()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reach-debug-log-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const reachLogger = new Logger();
