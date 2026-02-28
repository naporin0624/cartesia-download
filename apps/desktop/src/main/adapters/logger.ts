import log from 'electron-log/main.js';

log.initialize();
log.transports.file.level = import.meta.env.DEV ? 'debug' : 'info';
log.errorHandler.startCatching();

export const logger = log;
