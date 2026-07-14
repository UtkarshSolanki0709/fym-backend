import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler.middleware.js";

const hits = new Map<string, { count: number; resetsAt: number }>();

export function rateLimiter(keyFn: (req: Request) => string, max: number, windowMs: number) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || now > entry.resetsAt) {
      entry = { count: 0, resetsAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      next(new AppError(429, "RATE_LIMITED", "Too many requests"));
      return;
    }
    next();
  };
}
