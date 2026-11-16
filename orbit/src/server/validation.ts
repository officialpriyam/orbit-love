import { HttpError } from "./security";
import { z } from "zod";
const gender = z.enum(["Woman", "Man", "Non-binary", "Self-described"]);
export const loginSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase().trim()),
    password: z.string().min(12).max(128),
  })
  .strict();
export const deletionSchema = z
  .object({ password: z.string().min(12).max(128) })
  .strict();
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(1).max(60),
  consent: z.literal(true),
});
export const profileSchema = z
  .object({
    age: z.number().int().min(18).max(100),
    city: z.string().trim().max(80).default(""),
    country: z.string().trim().max(80).default(""),
    outside_country: z.boolean().default(false),
    openrouter_consent: z.boolean().default(false),
    occupation: z.string().trim().min(1).max(100),
    gender,
    orientation: z.string().max(80).default(""),
    intention: z.enum(["Dating", "Friendship"]),
    seeking: z.array(gender).min(1).max(4),
    min_age: z.number().int().min(18).max(100),
    max_age: z.number().int().min(18).max(100),
    any_city: z.boolean(),
    bio: z.string().max(500).default(""),
  })
  .strict()
  .refine((p) => p.min_age <= p.max_age, {
    message: "Preferred age range is invalid",
  });
export const answersSchema = z.record(
  z.string().regex(/^(?:[1-9]|[12][0-9]|3[0-9]|40)$/),
  z.enum(["A", "B", "C", "D", "E", "F", "G", "H"]),
);
export const surveySchema = z.object({ answers: answersSchema }).strict();
export const submissionSchema = surveySchema
  .extend({ consent: z.literal(true) })
  .refine((s) => Object.keys(s.answers).length === 40, {
    message: "Answer all 40 questions before submitting.",
  });
export const scheduleSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    closes_at: z.number().finite(),
  })
  .strict();
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(
      422,
      result.error.issues[0]?.message || "Check your input.",
    );
  }
  return result.data;
}
