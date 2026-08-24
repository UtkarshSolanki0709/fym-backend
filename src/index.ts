import app from "./app.js";
import { env } from "./config/env.js";
import { initStorage } from "./libs/r2Client.js";

try {
  await initStorage();
} catch (e: any) {
  console.error("R2 init failed:", e.message);
  process.exit(1);
}

app.listen(env.PORT, () => {
});
