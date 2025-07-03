import pino from "pino";

// Create a logger instance with structured logging
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: label => {
      return { level: label };
    },
  },
  base: {
    service: "arbitrage-bot",
  },
});

// Export specific loggers for different contexts
export const createLogger = (context: string) => {
  return logger.child({ context });
};
