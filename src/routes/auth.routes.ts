import { Router } from "express";
import { z } from "zod";
import { rateLimiter } from "../middleware/rateLimiter.middleware.js";
import { validateBody } from "../middleware/validateBody.middleware.js";
import { OTP, AUTH } from "../config/constants.js";
import * as authService from "../services/auth.service.js";

const router = Router();

const phoneOtpSendSchema = z.object({
  phone: z.string().min(8).max(20),
});

const phoneOtpVerifySchema = z.object({
  phone: z.string().min(8).max(20),
  token: z.string().min(4).max(12),
});

const emailOtpSendSchema = z.object({
  email: z.string().email(),
});

const emailOtpVerifySchema = z.object({
  email: z.string().email(),
  token: z.string().min(4).max(12),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const resetSchema = z.object({
  email: z.string().email(),
  redirect_to: z.string().url().optional(),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

// Phone SMS OTP
router.post(
  "/auth/otp/send",
  rateLimiter((req) => req.body?.phone ?? "anon", OTP.SEND_MAX, OTP.SEND_WINDOW_MS),
  validateBody(phoneOtpSendSchema),
  async (req, res, next) => {
    try {
      res.json(await authService.sendOtp(req.body.phone));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/auth/otp/verify",
  rateLimiter((req) => req.body?.phone ?? "anon", OTP.VERIFY_MAX, OTP.VERIFY_WINDOW_MS),
  validateBody(phoneOtpVerifySchema),
  async (req, res, next) => {
    try {
      res.json(await authService.verifyOtp(req.body.phone, req.body.token));
    } catch (e) {
      next(e);
    }
  },
);

// Email OTP (Brevo via Supabase)
router.post(
  "/auth/email-otp/send",
  rateLimiter((req) => req.body?.email ?? "anon", OTP.SEND_MAX, OTP.SEND_WINDOW_MS),
  validateBody(emailOtpSendSchema),
  async (req, res, next) => {
    try {
      res.json(await authService.sendEmailOtp(req.body.email));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/auth/email-otp/verify",
  rateLimiter((req) => req.body?.email ?? "anon", OTP.VERIFY_MAX, OTP.VERIFY_WINDOW_MS),
  validateBody(emailOtpVerifySchema),
  async (req, res, next) => {
    try {
      res.json(await authService.verifyEmailOtp(req.body.email, req.body.token));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/auth/password/reset",
  rateLimiter((req) => req.body?.email ?? "anon", AUTH.SIGNIN_MAX, AUTH.SIGNIN_WINDOW_MS),
  validateBody(resetSchema),
  async (req, res, next) => {
    try {
      res.json(
        await authService.requestPasswordReset(req.body.email, req.body.redirect_to),
      );
    } catch (e) {
      next(e);
    }
  },
);

// Optional password accounts (legacy / optional)
router.post(
  "/auth/signup",
  rateLimiter((req) => req.body?.email ?? "anon", AUTH.SIGNUP_MAX, AUTH.SIGNUP_WINDOW_MS),
  validateBody(signupSchema),
  async (req, res, next) => {
    try {
      res.json(await authService.signUp(req.body.email, req.body.password));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/auth/signin",
  rateLimiter((req) => req.body?.email ?? "anon", AUTH.SIGNIN_MAX, AUTH.SIGNIN_WINDOW_MS),
  validateBody(signinSchema),
  async (req, res, next) => {
    try {
      res.json(await authService.signIn(req.body.email, req.body.password));
    } catch (e) {
      next(e);
    }
  },
);

router.post("/auth/refresh", validateBody(refreshSchema), async (req, res, next) => {
  try {
    res.json(await authService.refreshSession(req.body.refresh_token));
  } catch (e) {
    next(e);
  }
});

export default router;
