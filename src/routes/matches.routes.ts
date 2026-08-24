import { Router } from "express";
import { auth } from "../middleware/auth.middleware.js";
import * as matchesService from "../services/matches.service.js";

const router = Router();

router.get("/matches", auth, async (req, res, next) => {
  try {
    res.json(await matchesService.listMatches(req.user!.id));
  } catch (e) {
    next(e);
  }
});

export default router;
