import { z } from 'zod';

/** Client-side mirrors of the server's auth validation (server stays authoritative). */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters and include a number.')
    .regex(/\d/, 'Password must be at least 8 characters and include a number.'),
  displayName: z.string().trim().min(1, 'Display name is required.'),
});

/** Register screen strength indicator: 0–3 (length, number, extra length). */
export function passwordStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/\d/.test(password)) score++;
  if (password.length >= 12) score++;
  return Math.min(score, 3);
}
