import { Router } from "express";
import { auth } from "../middleware/auth.middleware.js";
import { rateLimiter } from "../middleware/rateLimiter.middleware.js";
import { validateBody } from "../middleware/validateBody.middleware.js";
import {
  profileUpdateSchema,
  photoUploadSchema,
  interestsSchema,
  promptsSchema,
  quizSchema,
  preferencesSchema,
} from "../utils/validators/profile.schema.js";
import * as profileService from "../services/profile.service.js";

const router = Router();

router.get("/profile/me", auth, async (req, res, next) => {
  try {
    res.json(await profileService.getProfile(req.user!.id));
  } catch (e) { next(e); }
});

router.put("/profile/me", auth, validateBody(profileUpdateSchema), async (req, res, next) => {
  try {
    res.json(await profileService.updateProfile(req.user!.id, req.body));
  } catch (e) { next(e); }
});

router.post("/profile/photos", auth, validateBody(photoUploadSchema), async (req, res, next) => {
  try {
    res.json(await profileService.addPhoto(req.user!.id, req.body.photo));
  } catch (e) { next(e); }
});

router.delete("/profile/photos/:id", auth, async (req, res, next) => {
  try {
    await profileService.deletePhoto(req.user!.id, req.params.id);
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post(
  "/profile/interests",
  auth,
  rateLimiter((req) => req.user?.id ?? "anon", 10, 60_000),
  validateBody(interestsSchema),
  async (req, res, next) => {
    try {
      res.json(await profileService.updateInterests(req.user!.id, req.body.interests));
    } catch (e) { next(e); }
  },
);

router.post(
  "/profile/prompts",
  auth,
  rateLimiter((req) => req.user?.id ?? "anon", 10, 60_000),
  validateBody(promptsSchema),
  async (req, res, next) => {
    try {
      res.json(await profileService.updatePrompts(req.user!.id, req.body.prompts));
    } catch (e) { next(e); }
  },
);

router.post(
  "/profile/personality-quiz",
  auth,
  rateLimiter((req) => req.user?.id ?? "anon", 10, 60_000),
  validateBody(quizSchema),
  async (req, res, next) => {
    try {
      res.json(await profileService.updateQuiz(req.user!.id, req.body.answers));
    } catch (e) { next(e); }
  },
);

router.put(
  "/profile/preferences",
  auth,
  rateLimiter((req) => req.user?.id ?? "anon", 10, 60_000),
  validateBody(preferencesSchema),
  async (req, res, next) => {
    try {
      res.json(await profileService.updatePreferences(req.user!.id, req.body));
    } catch (e) { next(e); }
  },
);

export default router;
