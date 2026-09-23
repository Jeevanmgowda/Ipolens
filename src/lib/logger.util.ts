/**
 * Centralized logging utility for IPOLENS backend services.
 * Provides structured logging with appropriate log levels.
 */

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
}

class Logger {
  private logLevel: string;
  private logBuffer: LogEntry[];

  constructor() {
    this.logLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    this.logBuffer = [];
    // Enable structured logging in production
    this.logLevel = 'production' in process.env ? 'info' : this.logLevel;
  }

  private log(level: LogEntry['level'], message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    // Buffer for potential later async processing
    this.logBuffer.push(entry);

    // Keep buffer size manageable
    if (this.logBuffer.length > 1000) {
      this.logBuffer.splice(0, this.logBuffer.length - 500);
    }

    // Production vs development logging
    if (process.env.NODE_ENV === 'production') {
      this.productionLog(level, message, context);
    } else {
      this.developmentLog(level, message, context);
    }
  }

  private productionLog(level: LogEntry['level'], message: string, context?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    const contextStr = context && Object.keys(context).length ? ` ${JSON.stringify(context)}` : '';

    switch (level) {
      case 'error':
        console.error(`[ERROR] ${timestamp} - ${message}${contextStr}`);
        break;
      case 'warn':
        console.warn(`[WARN] ${timestamp} - ${message}${contextStr}`);
        break;
      case 'info':
        console.info(`[INFO] ${timestamp} - ${message}${contextStr}`);
        break;
      case 'debug':
        console.debug(`[DEBUG] ${timestamp} - ${message}${contextStr}`);
        break;
    }
  }

  private developmentLog(level: LogEntry['level'], message: string, context?: Record<string, any>): void {
    const color = this.getLogColor(level);
    const contextStr = context && Object.keys(context).length ? ` ${JSON.stringify(context)}` : '';

    console.log(
      `${color}[${level.toUpperCase()}]${this.reset}
      ${new Date().toISOString()} - ${message}${contextStr}`
    );
  }

  private getLogColor(level: LogEntry['level']): string {
    switch (level) {
      case 'error':
        return '\x1b[31m'; // Red
      case 'warn':
        return '\x1b[33m'; // Yellow
      case 'info':
        return '\x1b[36m'; // Cyan
      case 'debug':
        return '\x1b[90m'; // Gray
      default:
        return '\x1b[37m'; // White
    }
  }

  private reset = '\x1b[0m';

  // Log level getters
  get debug(): (message: string, context?: Record<string, any>) => void {
    return (message: string, context?: Record<string, any>) => this.log('debug', message, context);
  }

  get info(): (message: string, context?: Record<string, any>) => void {
    return (message: string, context?: Record<string, any>) => this.log('info', message, context);
  }

  get warn(): (message: string, context?: Record<string, any>) => void {
    return (message: string, context?: Record<string, any>) => this.log('warn', message, context);
  }

  get error(): (message: string, context?: Record<string, any>) => void {
    return (message: string, context?: Record<string, any>) => this.log('error', message, context);
  }

  // Export captured logs for monitoring
  exportLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  // Clear logs (used in tests)
  clearLogs(): void {
    this.logBuffer = [];
  }
}

export const logger = new Logger();

// Convenience logging functions
export const log = {
  debug: logger.debug,
  info: logger.info,
  warn: logger.warn,
  error: logger.error,
  export: logger.exportLogs.bind(logger),
  clear: logger.clearLogs.bind(logger),
};