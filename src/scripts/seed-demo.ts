/**
 * Seed 7 demo profiles for stress-testing discovery/matching logic.
 *
 * Run from backend/:  npm run seed:demo
 * Optional:           npm run seed:demo -- --target=<real-user-uuid>
 *   → four personas (3 likes + 1 superlike, with notes) like the target,
 *     priming the who-liked-you screen and instant-match tests.
 *
 * Idempotent: existing demo users are updated in place, not duplicated.
 * Credentials: read from backend/.env (SUPABASE_URL, SUPABASE_SECRET_KEY).
 * Demo-account passwords come from SEED_DEMO_PASSWORD; if unset, one random
 * password is generated and printed once (never stored in source).
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "";
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY — run from backend/ with .env present.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=800&q=80&auto=format&fit=crop`;

/** Photo-less hours offsets relative to seed time — exercises activity bands */
const H = 3_600_000;
const D = 24 * H;

type Persona = {
  email: string;
  name: string;
  age: number;
  bio: string;
  geo: [number, number]; // (lat, lng) — written as WKT like the app does
  trust: number;
  percentile: number;
  verified: boolean;
  lastActiveHoursAgo: number; // plain hours — multiplied by H at write time
  createdDaysAgo: number;
  interests: string[];
  prompts: { question: string; answer: string }[];
  photos: string[];
};

const PERSONAS: Persona[] = [
  {
    email: "aarav@demo.fym.test",
    name: "Aarav",
    age: 26,
    bio: "Product designer in Bombay. I judge cafés by their filter coffee and their playlists.",
    geo: [19.076, 72.8777], // Mumbai
    trust: 120,
    percentile: 0.6,
    verified: true,
    lastActiveHoursAgo: 2,
    createdDaysAgo: 40,
    interests: ["trekking", "indie music", "coffee", "photography"],
    prompts: [
      { question: "Perfect Sunday looks like", answer: "Sanjay Gandhi trails at 7, third-wave coffee by 11, vinyl hunting by 4." },
      { question: "My most controversial opinion", answer: "Filter coffee > cold brew. Fight me politely." },
    ],
    photos: [img("1507003211169-0a1dd7228f2d"), img("1500648767791-00dcc994a43e"), img("1506794778202-cad84cf45f1d")],
  },
  {
    email: "diya@demo.fym.test",
    name: "Diya",
    age: 24,
    bio: "Pediatric nurse, Kathak dancer, dog aunt to three. Pune side, always up for a sunrise trek.",
    geo: [18.5204, 73.8567], // Pune
    trust: 100,
    percentile: 0.5,
    verified: true,
    lastActiveHoursAgo: 26, // just past the 24h band
    createdDaysAgo: 20,
    interests: ["kathak", "cooking", "trekking", "dogs"],
    prompts: [
      { question: "You should not go out with me if", answer: "you think 5am is a reasonable time to be awake only for airports." },
      { question: "We'll get along if", answer: "you have strong feelings about ghee." },
    ],
    photos: [img("1494790108377-be9c29b29330"), img("1438761681033-6461ffad8d80"), img("1544005313-94ddf0286df2")],
  },
  {
    email: "kabir@demo.fym.test",
    name: "Kabir",
    age: 31,
    bio: "Standup comic. 10k runner. My cardio is heckling myself first. Delhi, but tolerable in winter.",
    geo: [28.6139, 77.209], // Delhi
    trust: 85,
    percentile: 0.42,
    verified: false,
    lastActiveHoursAgo: 72, // 3 days — 0.75 band
    createdDaysAgo: 60,
    interests: ["standup", "running", "craft beer", "chess"],
    prompts: [
      { question: "The way to win me over", answer: "Laugh at the joke that bombed. That's the real test." },
      { question: "Two truths and a lie", answer: "I opened for a famous comic once. I've never been to Manali. I own 14 chess sets." },
    ],
    photos: [img("1472099645785-5658abf4ff4e"), img("1519085360753-af0119f7cbe7")],
  },
  {
    email: "meera@demo.fym.test",
    name: "Meera",
    age: 29,
    bio: "Marine biologist. Scuba instructor on weekends. Will absolutely show you crab photos. They/them-friendly, cat-owned.",
    geo: [19.1176, 72.906], // Mumbai (Powai)
    trust: 150,
    percentile: 0.75,
    verified: true,
    lastActiveHoursAgo: 6,
    createdDaysAgo: 2, // novelty boost band
    interests: ["scuba", "documentaries", "coffee", "cats"],
    prompts: [
      { question: "My simple pleasures", answer: "Reef clarity of 30m, black coffee, and my cat ignoring me on cue." },
      { question: "The hallmark of a good relationship", answer: "Splitting the last piece of tiramisu without keeping score." },
    ],
    photos: [img("1580489944761-15a19d654956"), img("1517841905240-472988babdf9"), img("1524504388940-b1c1722653e1")],
  },
  {
    email: "rohan@demo.fym.test",
    name: "Rohan",
    age: 35,
    bio: "Run a restaurant in Jaipur, run marathons before it opens. Feed people, then run away. Literally.",
    geo: [26.9124, 75.7873], // Jaipur
    trust: 60, // low trust — tests floor + badge absence
    percentile: 0.3,
    verified: false,
    lastActiveHoursAgo: 288, // 12 days — 0.4 band
    createdDaysAgo: 90, // stale novelty
    interests: ["running", "cooking", "travel", "chess"],
    prompts: [
      { question: "My love language is", answer: "Feeding you until you need a nap. Then a 10k, apparently." },
      { question: "Green flags I look for", answer: "Says thank you to waitstaff. Loses chess gracefully." },
    ],
    photos: [img("1560250097-0b93528c311a"), img("1568602471122-7832951cc4c5")],
  },
  {
    email: "sana@demo.fym.test",
    name: "Sana",
    age: 27,
    bio: "UX researcher and night-shift poet (they/them). Bengaluru. Ask me about bus-route ethnography.",
    geo: [12.9716, 77.5946], // Bengaluru
    trust: 95,
    percentile: 0.47,
    verified: true,
    lastActiveHoursAgo: 120, // 5 days
    createdDaysAgo: 8,
    interests: ["poetry", "indie music", "coffee", "cats"],
    prompts: [
      { question: "I'm looking for", answer: "Someone to split a filter coffee and a poetry open-mic list with." },
      { question: "Unusual skill", answer: "I can find a metaphor for any metro delay. Any." },
    ],
    photos: [img("1534528741775-53994a69daeb"), img("1508214751196-bcfd4ca60f91")],
  },
  {
    email: "vikram@demo.fym.test",
    name: "Vikram",
    age: 38,
    bio: "Bird photographer, retired athlete, Kochi. The early worm gets photographed. Patience is the whole personality.",
    geo: [9.9312, 76.2672], // Kochi
    trust: 110,
    percentile: 0.55,
    verified: false,
    lastActiveHoursAgo: 1080, // 45 days — lowest recency band
    createdDaysAgo: 120,
    interests: ["photography", "trekking", "birdwatching", "documentaries"],
    prompts: [
      { question: "A life goal of mine", answer: "Photograph every kingfisher species on the coast before my knees quit." },
      { question: "I geek out on", answer: "Prime lenses and tide charts. Romantic, I know." },
    ],
    photos: [img("1552058544-f2b08422138a"), img("1506794778202-cad84cf45f1d")],
  },
];

/** Who likes the --target, with what action + note (tests who-liked-you depth) */
const TARGET_LIKES: { email: string; action: "like" | "superlike"; note: string }[] = [
  { email: "meera@demo.fym.test", action: "superlike", note: "That tiramisu answer? Instant superlike. Coffee this weekend?" },
  { email: "aarav@demo.fym.test", action: "like", note: "Filtered coffee solidarity. ☕" },
  { email: "sana@demo.fym.test", action: "like", note: "Bus-route ethnography is my Roman Empire." },
  { email: "diya@demo.fym.test", action: "like", note: "" }, // no note — tests the plain fallback line
];

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (!data.users.length || data.users.length < 200 || page > 10) return null;
    page++;
  }
}

async function upsertPersona(p: Persona, password: string): Promise<{ id: string; created: boolean }> {
  let userId = await findAuthUserIdByEmail(p.email);
  let created = false;

  if (!userId) {
    const { data, error } = await sb.auth.admin.createUser({
      email: p.email,
      password,
      email_confirm: true,
      user_metadata: { display_name: p.name, demo: true },
    });
    if (error) throw new Error(`createUser(${p.email}): ${error.message}`);
    userId = data.user!.id;
    created = true;
  }

  const payload = {
    display_name: p.name,
    bio: p.bio,
    age: p.age,
    geolocation: `POINT(${p.geo[1]} ${p.geo[0]})`, // same WKT form the app writes
    interests: p.interests,
    prompts: p.prompts,
    photos: p.photos.map((url, i) => ({ id: `demo-${i + 1}`, url })),
    is_verified: p.verified,
    trust_score: p.trust,
    trust_score_percentile: p.percentile,
    status: "active",
    onboarding_step: "complete",
    last_active_at: new Date(Date.now() - p.lastActiveHoursAgo * H).toISOString(),
    created_at: new Date(Date.now() - p.createdDaysAgo * D).toISOString(),
  };

  const { data: updated, error: upErr } = await sb
    .from("profiles")
    .update(payload)
    .eq("id", userId)
    .select("id")
    .maybeSingle();
  if (upErr) throw new Error(`update profile(${p.email}): ${upErr.message}`);
  if (!updated) {
    // trigger handle_new_user missing in this environment → create directly
    const { error } = await sb.from("profiles").insert({ id: userId, ...payload });
    if (error) throw new Error(`insert profile(${p.email}): ${error.message}`);
  }

  // Re-run with SEED_DEMO_PASSWORD set → keep existing demo accounts on the
  // chosen password so all personas stay sign-in-able with one credential.
  if (process.env.SEED_DEMO_PASSWORD && !created) {
    await sb.auth.admin.updateUserById(userId, { password: process.env.SEED_DEMO_PASSWORD });
  }

  return { id: userId, created };
}

async function likeTarget(targetId: string) {
  // Fresh-account novelty only works if the target hasn't already decided
  // these personas — incomingLikes excludes swiped-back rows.
  const { data: mine } = await sb.from("swipes").select("swiper_id").eq("swiper_id", targetId);
  const alreadySwiped = new Set((mine ?? []).map((r) => r.swiper_id));

  for (const like of TARGET_LIKES) {
    const persona = PERSONAS.find((x) => x.email === like.email)!;
    const id = await findAuthUserIdByEmail(persona.email);
    if (!id) continue;
    if (alreadySwiped.has(id)) {
      console.log(`  skip ${persona.name} — target already swiped them (who-liked-you hides decided likes)`);
      continue;
    }
    const { error } = await sb.from("swipes").upsert(
      { swiper_id: id, target_id: targetId, action: like.action, note: like.note || null },
      { onConflict: "swiper_id,target_id", ignoreDuplicates: true },
    );
    console.log(error ? `  FAIL ${persona.name}: ${error.message}` : `  ${persona.name} → ${like.action}${like.note ? " (with note)" : ""}`);
  }
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--target="));
  const targetId = arg?.split("=")[1];

  let password = process.env.SEED_DEMO_PASSWORD ?? "";
  if (!password) {
    password = `Fym-${randomBytes(9).toString("base64url")}`;
    console.log(`SEED_DEMO_PASSWORD not set — generated (save it if you want to sign in as these accounts):\n  ${password}\n`);
  }

  console.log("Seeding 7 demo personas…\n");
  const rows: { name: string; id: string; created: boolean }[] = [];
  for (const p of PERSONAS) {
    const r = await upsertPersona(p, password);
    rows.push({ name: p.name, id: r.id, created: r.created });
    console.log(`  ${p.name.padEnd(7)} ${r.id}  ${r.created ? "(auth user created)" : "(updated)"}`);
  }

  if (targetId) {
    console.log(`\nPriming incoming likes toward target ${targetId}…`);
    const { data: prof } = await sb.from("profiles").select("id").eq("id", targetId).maybeSingle();
    if (!prof) {
      console.error("  target id not found in profiles — check the uuid");
      process.exit(1);
    }
    await likeTarget(targetId);
  } else {
    console.log("\nNo --target given — skipped incoming-like priming.");
  }

  console.log("\nPersonas (for Supabase dashboard reference):");
  for (const r of rows) console.log(`  ${r.name.padEnd(7)} ${r.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
