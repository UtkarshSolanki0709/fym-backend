import { Router } from "express";
import { auth } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validateBody.middleware.js";
import { z } from "zod";
import * as pushService from "../services/push.service.js";
import { AppError } from "../middleware/errorHandler.middleware.js";

const router = Router();

router.post(
  "/push/register",
  auth,
  validateBody(
    z.object({
      token: z.string().min(10).max(500),
      platform: z.string().max(40).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      await pushService.registerToken(
        req.user!.id,
        req.body.token,
        req.body.platform ?? "unknown",
      );
      res.json({ ok: true });
    } catch (e) {
      next(
        e instanceof AppError
          ? e
          : new AppError(400, "PUSH_REGISTER_FAILED", e instanceof Error ? e.message : "fail"),
      );
    }
  },
);

export default router;
