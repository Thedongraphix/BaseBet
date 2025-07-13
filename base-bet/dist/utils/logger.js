"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
class Logger {
    static formatTime() {
        return new Date().toISOString();
    }
    static info(message, ...args) {
        console.log(`[${this.formatTime()}] [INFO] ${message}`, ...args);
    }
    static error(message, ...args) {
        console.error(`[${this.formatTime()}] [ERROR] ${message}`, ...args);
    }
    static warn(message, ...args) {
        console.warn(`[${this.formatTime()}] [WARN] ${message}`, ...args);
    }
    static debug(message, ...args) {
        console.debug(`[${this.formatTime()}] [DEBUG] ${message}`, ...args);
    }
}
exports.Logger = Logger;
