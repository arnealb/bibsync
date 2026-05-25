import { z } from "zod";

import { copy } from "@/lib/copy";

const email = z.string().trim().email(copy.validation.emailInvalid);
const password = z.string().min(8, copy.validation.passwordTooShort);

export const loginSchema = z.object({
  email,
  password,
});

export const magicLinkSchema = z.object({
  email,
});

export const registerSchema = z.object({
  email,
  password,
  displayName: z
    .string()
    .trim()
    .min(1, copy.validation.displayNameRequired)
    .max(40, copy.validation.displayNameTooLong),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
