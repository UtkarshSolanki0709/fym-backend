import app from "./app.js";
import { env } from "./config/env.js";
import { initStorage } from "./libs/r2Client.js";

try {
  await initStorage();
  console.log("R2 storage initialized");
} catch (e: any) {
  console.warn("R2 storage initialization warning:", e.message);
}

app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`FYM backend listening on 0.0.0.0:${env.PORT} (${env.NODE_ENV})`);
});
