import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validateBody.middleware.js";
import { getOnboardingStatus, updateOnboardingStep } from "../services/profile.service.js";

const router = Router();

const stepSchema = z.object({
  step: z.enum(["liveness_done", "basic_info", "photos", "interests", "prompts", "quiz", "complete"]),
});

router.get("/onboarding/status", auth, async (req, res, next) => {
  try {
    res.json(await getOnboardingStatus(req.user!.id));
  } catch (e) { next(e); }
});

router.put("/onboarding/step", auth, validateBody(stepSchema), async (req, res, next) => {
  try {
    res.json(await updateOnboardingStep(req.user!.id, req.body.step));
  } catch (e) { next(e); }
});

export default router;
