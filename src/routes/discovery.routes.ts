import { Router } from "express";
import { auth } from "../middleware/auth.middleware.js";
import { rateLimiter } from "../middleware/rateLimiter.middleware.js";
import * as discoveryService from "../services/discovery.service.js";

const router = Router();

router.get(
  "/discovery",
  auth,
  rateLimiter((req) => req.user?.id ?? "anon", 30, 60_000),
  async (req, res, next) => {
    try {
      res.json(await discoveryService.getDiscoveryBatch(req.user!.id));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
