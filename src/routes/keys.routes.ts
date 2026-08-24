import { Router } from "express";
import { auth } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validateBody.middleware.js";
import { z } from "zod";
import * as keysService from "../services/keys.service.js";

const router = Router();

router.post(
  "/keys/publish",
  auth,
  validateBody(z.object({ public_key: z.string().min(20).max(8000) })),
  async (req, res, next) => {
    try {
      res.json(await keysService.publishKey(req.user!.id, req.body.public_key));
    } catch (e) {
      next(e);
    }
  },
);

router.get("/keys/:userId", auth, async (req, res, next) => {
  try {
    res.json(await keysService.getKey(req.params.userId));
  } catch (e) {
    next(e);
  }
});

export default router;
