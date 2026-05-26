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

/** Body of a POST to /api/steps from an Apple Shortcut. */
export const apiStepsSchema = z.object({
  token: z.string().min(10).max(200),
  roomId: z.string().uuid(),
  steps: z.number().int().min(1).max(100_000),
});
export type ApiStepsInput = z.infer<typeof apiStepsSchema>;
