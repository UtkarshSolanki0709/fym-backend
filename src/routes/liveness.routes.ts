import { Router } from "express";
import { auth } from "../middleware/auth.middleware.js";
import { rateLimiter } from "../middleware/rateLimiter.middleware.js";
import { validateBody } from "../middleware/validateBody.middleware.js";
import { livenessSchema } from "../utils/validators/profile.schema.js";
import { verifyLiveness } from "../services/liveness.service.js";

const router = Router();

router.post(
  "/onboarding/liveness",
  auth,
  rateLimiter(() => "liveness", 5, 60_000),
  validateBody(livenessSchema),
  async (req, res, next) => {
    try {
      res.json(await verifyLiveness(req.user!.id, req.body.frames));
    } catch (e) { next(e); }
  },
);

export default router;
