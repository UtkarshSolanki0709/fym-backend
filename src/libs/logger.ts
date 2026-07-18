import pino from "pino";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";

export const log = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
});

/** Single request logger — mount once in app.ts */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    log.info(
      {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        ms: Date.now() - start,
      },
      "req",
    );
  });
  next();
}
