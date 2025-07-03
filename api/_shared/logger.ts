import pino from "pino";

// Create a logger instance with structured logging
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
      messageFormat: "{msg} {context}",
      customColors: "err:red,info:blue,warn:yellow,debug:green",
      customLevels: "err:0,info:1,warn:2,debug:3",
    },
  },
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
