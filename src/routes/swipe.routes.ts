import { Router, type Request, type Response, type NextFunction } from "express";
import { auth } from "../middleware/auth.middleware.js";
import { rateLimiter } from "../middleware/rateLimiter.middleware.js";
import { validateBody } from "../middleware/validateBody.middleware.js";
import {
  likeSchema,
  passBatchSchema,
  superlikeSchema,
} from "../utils/validators/swipe.schema.js";
import * as swipeService from "../services/swipe.service.js";

const router = Router();

router.post(
  "/swipe/like",
  auth,
  rateLimiter((req) => req.user?.id ?? "anon", 60, 60_000),
  validateBody(likeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await swipeService.like(req.user!.id, req.body.target_id, req.body.note));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/swipe/superlike",
  auth,
  rateLimiter((req) => req.user?.id ?? "anon", 20, 60_000),
  validateBody(superlikeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await swipeService.superlike(req.user!.id, req.body.target_id, req.body.note));
    } catch (e) {
      next(e);
    }
  },
);

router.get("/swipe/likes", auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await swipeService.incomingLikes(req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.post(
  "/swipe/pass/batch",
  auth,
  rateLimiter((req) => req.user?.id ?? "anon", 20, 60_000),
  validateBody(passBatchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await swipeService.passBatch(req.user!.id, req.body.items));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
