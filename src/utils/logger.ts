/**
 * Reach Client Logger
 * Captures logs in-memory for export to GitHub issues.
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

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
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  constructor() {
    this.init();
  }

  public log(...args: unknown[]) { console.log(...args); }
  public info(...args: unknown[]) { console.info(...args); }
  public warn(...args: unknown[]) { console.warn(...args); }
  public error(...args: unknown[]) { console.error(...args); }
  public debug(...args: unknown[]) { console.debug(...args); }

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
                  const lowerKey = key.toLowerCase();
                  if ([
                    'access_token', 'password', 'recovery_key', 'private_key', 'token',
                    'sid', 'session_id', 'sender_key', 'pk', 'sk', 'mac', 'iv', 'key'
                  ].includes(lowerKey)) {
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
