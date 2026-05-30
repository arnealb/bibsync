import { z } from "zod";

import { copy } from "@/lib/copy";

/** Bibcoins charged for changing your display name (capped to once per day). */
export const DISPLAY_NAME_CHANGE_COST = 500;

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, copy.validation.displayNameRequired)
  .max(40, copy.validation.displayNameTooLong);
