import { Router } from "express";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.get("/ping", (_req, res) => {
  res.status(200).send("pong");
});

export default router;
