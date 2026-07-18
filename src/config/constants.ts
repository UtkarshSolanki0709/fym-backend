export const AUTH = {
  SIGNUP_WINDOW_MS: 60_000,
  SIGNUP_MAX: 3,
  SIGNIN_WINDOW_MS: 60_000,
  SIGNIN_MAX: 10,
};

export const OTP = {
  SEND_WINDOW_MS: 60_000,
  SEND_MAX: 3,
  VERIFY_WINDOW_MS: 60_000,
  VERIFY_MAX: 10,
};

export const PHOTO = {
  MAX_COUNT: 6,
};

export const LIVENESS = {
  FRAME_RETENTION_DAYS: 30,
  DUPLICATE_HASH_THRESHOLD: 0.05,
};

export const SWIPE = {
  FREE_DAILY: 20,
  PLUS_DAILY: 100,
  PRO_DAILY: 999_999,
  SUPERLIKE_FREE: 1,
  SUPERLIKE_PLUS: 5,
  SUPERLIKE_PRO: 999_999,
  BATCH_SIZE: 5,
  REVIEW_COOLDOWN_DAYS: 30,
};

/** Tags that hit trust harder (Backend.md §4.4) */
export const NEGATIVE_REVIEW_TAGS = new Set([
  "Catfish vibes",
  "Inappropriate",
  "Fake profile",
]);

export const RANKING = {
  preference_fit: 0.35,
  trust_score: 0.2,
  proximity: 0.15,
  activity_recency: 0.15,
  interest_overlap: 0.1,
  novelty: 0.05,
  TRUST_FLOOR: 0.02,
  BATCH: 20,
};
