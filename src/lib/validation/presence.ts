import { z } from "zod";

export const PRESENCE_STATUSES = [
  "studying",
  "break",
  "lunch",
  "away",
  "done",
] as const;

/** Statuses for which a "back at" time is meaningful. */
export const STATUSES_WITH_BACK_AT: readonly string[] = ["break", "lunch"];

const QUARTER_HOUR = /^([01]\d|2[0-3]):(00|15|30|45)$/;

export const setPresenceSchema = z.object({
  roomId: z.string().uuid(),
  status: z.enum(PRESENCE_STATUSES),
  backAt: z.string().regex(QUARTER_HOUR).nullable().optional(),
});

export type SetPresenceInput = z.infer<typeof setPresenceSchema>;

/** A browser location reading sent to compare against the room geofence. */
export const reportLocationSchema = z.object({
  roomId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type ReportLocationInput = z.infer<typeof reportLocationSchema>;
