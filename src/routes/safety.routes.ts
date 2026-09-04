import { Router } from "express";
import { auth } from "../middleware/auth.middleware.js";
import { rateLimiter } from "../middleware/rateLimiter.middleware.js";
import { validateBody } from "../middleware/validateBody.middleware.js";
import {
  blockSchema,
  grievanceSchema,
  reportSchema,
} from "../utils/validators/safety.schema.js";
import * as safetyService from "../services/safety.service.js";

const router = Router();

router.post(
  "/report",
  auth,
  rateLimiter((req) => req.user?.id ?? "anon", 10, 60_000),
  validateBody(reportSchema),
  async (req, res, next) => {
    try {
      res.status(201).json(await safetyService.submitReport(req.user!.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/report/block",
  auth,
  rateLimiter((req) => req.user?.id ?? "anon", 20, 60_000),
  validateBody(blockSchema),
  async (req, res, next) => {
    try {
      res.json(await safetyService.blockUser(req.user!.id, req.body.target_id));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/grievance",
  auth,
  rateLimiter((req) => req.user?.id ?? "anon", 5, 60_000),
  validateBody(grievanceSchema),
  async (req, res, next) => {
    try {
      res.status(201).json(await safetyService.submitGrievance(req.user!.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
