import type { Request, Response, NextFunction } from "express";
import { supabase } from "../libs/supabaseClient.js";
import { AppError } from "./errorHandler.middleware.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string };
    }
  }
}

export async function auth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "MISSING_TOKEN", "Authorization header required");
    }
    const token = header.slice(7);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new AppError(401, "INVALID_TOKEN", "Invalid or expired token");
    }
    req.user = { id: data.user.id, email: data.user.email ?? undefined };
    next();
  } catch (e) {
    next(e);
  }
}
