import { Router } from "express";
import { auth } from "../middleware/auth.middleware.js";
import { rateLimiter } from "../middleware/rateLimiter.middleware.js";
import { validateBody } from "../middleware/validateBody.middleware.js";
import { z } from "zod";
import * as chatService from "../services/chat.service.js";

const router = Router();

const sendSchema = z.object({
  ciphertext: z.string().min(1),
  nonce: z.string().min(1),
  client_id: z.string().uuid(),
  content_type: z.enum(["text", "image", "system"]).optional(),
});

router.get("/chat/:roomId/messages", auth, async (req, res, next) => {
  try {
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    res.json(await chatService.listMessages(req.params.roomId, req.user!.id, { cursor, limit }));
  } catch (e) {
    next(e);
  }
});

router.post(
  "/chat/:roomId/messages",
  auth,
  rateLimiter((req) => `${req.user?.id}:chat`, 40, 60_000),
  validateBody(sendSchema),
  async (req, res, next) => {
    try {
      res.json(await chatService.sendMessage(req.params.roomId, req.user!.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.put("/chat/:roomId/read", auth, async (req, res, next) => {
  try {
    res.json(await chatService.markRead(req.params.roomId, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.post(
  "/chat/:roomId/media",
  auth,
  rateLimiter((req) => `${req.user?.id}:media`, 20, 60_000),
  validateBody(
    z.object({
      ciphertext_b64: z.string().min(1),
      mime: z.string().min(3).max(100),
    }),
  ),
  async (req, res, next) => {
    try {
      res.json(await chatService.storeChatMedia(req.params.roomId, req.user!.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.get("/chat/:roomId/media", auth, async (req, res, next) => {
  try {
    const mediaId = String(req.query.mediaId ?? "");
    if (!mediaId) {
      res.status(400).json({ code: "MISSING_MEDIA_ID", error: "mediaId required" });
      return;
    }
    res.json(await chatService.getChatMedia(req.params.roomId, req.user!.id, mediaId));
  } catch (e) {
    next(e);
  }
});

export default router;
