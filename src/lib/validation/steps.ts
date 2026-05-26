import { z } from "zod";

export const STEP_SOURCES = ["browser", "health"] as const;
export const stepSourceSchema = z.enum(STEP_SOURCES);
export type StepSource = z.infer<typeof stepSourceSchema>;

/** A browser-pedometer session saved from the app. */
export const saveStepSessionSchema = z.object({
  roomId: z.string().uuid(),
  steps: z.number().int().min(1).max(100_000),
  source: stepSourceSchema.default("browser"),
});
export type SaveStepSessionInput = z.infer<typeof saveStepSessionSchema>;

/**
 * Body of a POST to /api/steps from an Apple Shortcut. Credentials can be given
 * either as a single `code` ("token~roomId", one paste) or as separate fields.
 */
export const apiStepsSchema = z.object({
  code: z.string().min(10).max(400).optional(),
  token: z.string().min(10).max(200).optional(),
  roomId: z.string().uuid().optional(),
  steps: z.number().int().min(1).max(100_000),
});
export type ApiStepsInput = z.infer<typeof apiStepsSchema>;

/** Delimiter between token and roomId in a copy-paste "koppelcode". */
export const STEP_CODE_SEPARATOR = "~";

/** Resolves token + roomId from an /api/steps body, or null if unusable. */
export function resolveStepCredentials(input: ApiStepsInput): {
  token: string;
  roomId: string;
} | null {
  let token = input.token;
  let roomId = input.roomId;
  if (input.code) {
    const [t, r] = input.code.split(STEP_CODE_SEPARATOR);
    token = t;
    roomId = r;
  }
  if (!token || token.length < 10) return null;
  if (!roomId || !z.string().uuid().safeParse(roomId).success) return null;
  return { token, roomId };
}
