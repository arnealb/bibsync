/** A US state: postal code, canonical English name, and whether it's too small
 *  to fit its full name on the map (shows the postal code instead). */
export interface UsState {
  code: string;
  name: string;
  small: boolean;
}

/** The 50 states. `small` = the cramped north-eastern cluster. */
export const US_STATES: readonly UsState[] = [
  { code: "AL", name: "Alabama", small: false },
  { code: "AK", name: "Alaska", small: false },
  { code: "AZ", name: "Arizona", small: false },
  { code: "AR", name: "Arkansas", small: false },
  { code: "CA", name: "California", small: false },
  { code: "CO", name: "Colorado", small: false },
  { code: "CT", name: "Connecticut", small: true },
  { code: "DE", name: "Delaware", small: true },
  { code: "FL", name: "Florida", small: false },
  { code: "GA", name: "Georgia", small: false },
  { code: "HI", name: "Hawaii", small: false },
  { code: "ID", name: "Idaho", small: false },
  { code: "IL", name: "Illinois", small: false },
  { code: "IN", name: "Indiana", small: false },
  { code: "IA", name: "Iowa", small: false },
  { code: "KS", name: "Kansas", small: false },
  { code: "KY", name: "Kentucky", small: false },
  { code: "LA", name: "Louisiana", small: false },
  { code: "ME", name: "Maine", small: false },
  { code: "MD", name: "Maryland", small: true },
  { code: "MA", name: "Massachusetts", small: true },
  { code: "MI", name: "Michigan", small: false },
  { code: "MN", name: "Minnesota", small: false },
  { code: "MS", name: "Mississippi", small: false },
  { code: "MO", name: "Missouri", small: false },
  { code: "MT", name: "Montana", small: false },
  { code: "NE", name: "Nebraska", small: false },
  { code: "NV", name: "Nevada", small: false },
  { code: "NH", name: "New Hampshire", small: true },
  { code: "NJ", name: "New Jersey", small: true },
  { code: "NM", name: "New Mexico", small: false },
  { code: "NY", name: "New York", small: false },
  { code: "NC", name: "North Carolina", small: false },
  { code: "ND", name: "North Dakota", small: false },
  { code: "OH", name: "Ohio", small: false },
  { code: "OK", name: "Oklahoma", small: false },
  { code: "OR", name: "Oregon", small: false },
  { code: "PA", name: "Pennsylvania", small: false },
  { code: "RI", name: "Rhode Island", small: true },
  { code: "SC", name: "South Carolina", small: false },
  { code: "SD", name: "South Dakota", small: false },
  { code: "TN", name: "Tennessee", small: false },
  { code: "TX", name: "Texas", small: false },
  { code: "UT", name: "Utah", small: false },
  { code: "VT", name: "Vermont", small: true },
  { code: "VA", name: "Virginia", small: false },
  { code: "WA", name: "Washington", small: false },
  { code: "WV", name: "West Virginia", small: false },
  { code: "WI", name: "Wisconsin", small: false },
  { code: "WY", name: "Wyoming", small: false },
];

/** Fast membership check for a postal code. */
export const US_STATE_CODES: ReadonlySet<string> = new Set(
  US_STATES.map((s) => s.code),
);

/** Tuple form for `z.enum(...)` (single source of truth for the codes). */
export const US_STATE_CODE_TUPLE = US_STATES.map((s) => s.code) as [
  string,
  ...string[],
];

/** Lookup a state by its postal code. */
export function stateByCode(code: string): UsState | undefined {
  return US_STATES.find((s) => s.code === code);
}
