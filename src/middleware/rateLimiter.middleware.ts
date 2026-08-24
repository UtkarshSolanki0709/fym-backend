import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler.middleware.js";

// ponytail: in-memory, resets on restart. Swap to Redis/DB when multi-instance.
const hits = new Map<string, { count: number; resetsAt: number }>();
let lastPruned = Date.now();
const PRUNE_INTERVAL_MS = 60_000;

function pruneExpired(now: number) {
  if (now - lastPruned < PRUNE_INTERVAL_MS) return;
  lastPruned = now;
  for (const [k, v] of hits.entries()) {
    if (now > v.resetsAt) {
      hits.delete(k);
    }
  }
}

export function rateLimiter(keyFn: (req: Request) => string, max: number, windowMs: number) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    pruneExpired(now);

    const key = keyFn(req);
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
