import express from "express";
import { errorHandler } from "./middleware/errorHandler.middleware.js";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import livenessRoutes from "./routes/liveness.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import onboardingRoutes from "./routes/onboarding.routes.js";

const app = express();

app.use(express.json());
app.get("/", (_req, res) => res.json({ message: "Find Your Match API" }));
app.use(healthRoutes);
app.use(authRoutes);
app.use(livenessRoutes);
app.use(profileRoutes);
app.use(onboardingRoutes);
app.use(errorHandler);

export default app;
