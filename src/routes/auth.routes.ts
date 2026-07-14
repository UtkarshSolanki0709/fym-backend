import { Router } from "express";
import { z } from "zod";
import { rateLimiter } from "../middleware/rateLimiter.middleware.js";
import { validateBody } from "../middleware/validateBody.middleware.js";
import { OTP, AUTH } from "../config/constants.js";
import * as authService from "../services/auth.service.js";

const router = Router();

const otpSendSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, "E.164 format required"),
});

const otpVerifySchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/),
  token: z.string().length(6),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

router.post(
  "/auth/otp/send",
  rateLimiter((req) => req.body?.phone, OTP.SEND_MAX, OTP.SEND_WINDOW_MS),
  validateBody(otpSendSchema),
  async (req, res, next) => {
    try {
      res.json(await authService.sendOtp(req.body.phone));
    } catch (e) { next(e); }
  },
);

router.post(
  "/auth/otp/verify",
  rateLimiter((req) => req.body?.phone, OTP.VERIFY_MAX, OTP.VERIFY_WINDOW_MS),
  validateBody(otpVerifySchema),
  async (req, res, next) => {
    try {
      res.json(await authService.verifyOtp(req.body.phone, req.body.token));
    } catch (e) { next(e); }
  },
);

router.post(
  "/auth/signup",
  rateLimiter((req) => req.body?.email, AUTH.SIGNUP_MAX, AUTH.SIGNUP_WINDOW_MS),
  validateBody(signupSchema),
  async (req, res, next) => {
    try {
      res.json(await authService.signUp(req.body.email, req.body.password));
    } catch (e) { next(e); }
  },
);

router.post(
  "/auth/signin",
  rateLimiter((req) => req.body?.email, AUTH.SIGNIN_MAX, AUTH.SIGNIN_WINDOW_MS),
  validateBody(signinSchema),
  async (req, res, next) => {
    try {
      res.json(await authService.signIn(req.body.email, req.body.password));
    } catch (e) { next(e); }
  },
);

router.post(
  "/auth/refresh",
  validateBody(refreshSchema),
  async (req, res, next) => {
    try {
      res.json(await authService.refreshSession(req.body.refresh_token));
    } catch (e) { next(e); }
  },
);

export default router;
