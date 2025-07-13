export class Logger {
  private static formatTime(): string {
    return new Date().toISOString();
  }

  static info(message: string, ...args: any[]): void {
    console.log(`[${this.formatTime()}] [INFO] ${message}`, ...args);
  }

  static error(message: string, ...args: any[]): void {
    console.error(`[${this.formatTime()}] [ERROR] ${message}`, ...args);
  }

  static warn(message: string, ...args: any[]): void {
    console.warn(`[${this.formatTime()}] [WARN] ${message}`, ...args);
  }

  static debug(message: string, ...args: any[]): void {
    console.debug(`[${this.formatTime()}] [DEBUG] ${message}`, ...args);
  }
} 