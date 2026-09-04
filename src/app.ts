import express from "express";
import { errorHandler } from "./middleware/errorHandler.middleware.js";
import { requestLogger } from "./libs/logger.js";
import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import livenessRoutes from "./routes/liveness.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import onboardingRoutes from "./routes/onboarding.routes.js";
import discoveryRoutes from "./routes/discovery.routes.js";
import swipeRoutes from "./routes/swipe.routes.js";
import safetyRoutes from "./routes/safety.routes.js";
import mediaRoutes from "./routes/media.routes.js";
import keysRoutes from "./routes/keys.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import matchesRoutes from "./routes/matches.routes.js";
import pushRoutes from "./routes/push.routes.js";

const app = express();

const ALLOWED_ORIGINS = env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(",").map(s => s.trim());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && (ALLOWED_ORIGINS as string[]).includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: "12mb" }));
app.use(requestLogger);
app.get("/", (_req, res) => res.json({ message: "Find Your Match API" }));
app.use(healthRoutes);
app.use(mediaRoutes);
app.use(authRoutes);
app.use(livenessRoutes);
app.use(profileRoutes);
app.use(onboardingRoutes);
app.use(discoveryRoutes);
app.use(swipeRoutes);
app.use(safetyRoutes);
app.use(keysRoutes);
app.use(chatRoutes);
app.use(matchesRoutes);
app.use(pushRoutes);
app.use(errorHandler);

export default app;
