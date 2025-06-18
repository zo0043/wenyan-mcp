const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

export function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) {
    const currentLevel = LOG_LEVELS[LOG_LEVEL as keyof typeof LOG_LEVELS] || 1;
    const messageLevel = LOG_LEVELS[level];
    if (messageLevel >= currentLevel) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        if (data) {
            console.log(logMessage, data);
        } else {
            console.log(logMessage);
        }
    }
} 