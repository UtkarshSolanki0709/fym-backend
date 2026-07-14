import { z } from "zod";

export const livenessSchema = z.object({
  frames: z.array(z.string().min(1)).length(3),
});

export const profileUpdateSchema = z.object({
  display_name: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  age: z.number().int().min(18).max(120).optional(),
  geolocation: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  gender_preference: z.enum(["male", "female", "both"]).optional(),
});

export const photoUploadSchema = z.object({
  photo: z.string().min(1),
});

export const interestsSchema = z.object({
  interests: z.array(z.string().min(1).max(30)).min(1).max(20),
});

export const promptsSchema = z.object({
  prompts: z.array(z.object({
    question: z.string().min(1).max(200),
    answer: z.string().min(1).max(500),
  })).min(1).max(3),
});

export const quizSchema = z.object({
  answers: z.array(z.object({
    question_id: z.string().min(1),
    value: z.number().int().min(1).max(5),
  })).length(6),
});

export const preferencesSchema = z.object({
  age_min: z.number().int().min(18).max(120).optional(),
  age_max: z.number().int().min(18).max(120).optional(),
  distance_km: z.number().int().min(1).max(500).optional(),
  gender_preference: z.enum(["male", "female", "both"]).optional(),
});
