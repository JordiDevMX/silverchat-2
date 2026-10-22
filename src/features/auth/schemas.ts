import { z } from "zod";
export const emailSchema = z.object({ email: z.email("Enter a valid email address").max(254) });
export const usernameSchema = z.object({
  username: z
    .string()
    .min(3, "Use at least 3 characters")
    .max(20, "Use no more than 20 characters")
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores")
    .refine(
      (value) => !/^user_[a-f0-9]{8}$/.test(value),
      "Choose a username that isn’t an automatically assigned name",
    ),
});
export const totpSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter all six digits") });
export const backupSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{10}$/, "Enter your 10-character backup code"),
});
