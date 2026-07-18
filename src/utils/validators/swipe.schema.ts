import { z } from "zod";

export const likeSchema = z.object({
  target_id: z.string().uuid(),
});

export const superlikeSchema = z.object({
  target_id: z.string().uuid(),
});

export const passBatchSchema = z.object({
  items: z
    .array(
      z.object({
        target_id: z.string().uuid(),
        tags: z.array(z.string().min(1).max(40)).min(1).max(5),
        review_text: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(5),
});
