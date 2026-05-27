/**
 * Alphabet for room join codes: uppercase letters + digits, excluding the
 * easily-confused characters 0/O/1/I/L.
 */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 6;

/** Bounds for a self-chosen custom join code (letters + digits). */
export const CUSTOM_CODE_MIN = 4;
export const CUSTOM_CODE_MAX = 12;
export const CUSTOM_CODE_PATTERN = /^[A-Z0-9]+$/;

/** Codes are matched case-insensitively (see the `join_room` RPC), so we
 *  store and compare them upper-cased. */
export function normalizeJoinCode(input: string): string {
  return input.trim().toUpperCase();
}

/** Whether `code` (already normalized) is a valid custom code. */
export function isValidCustomCode(code: string): boolean {
  return (
    code.length >= CUSTOM_CODE_MIN &&
    code.length <= CUSTOM_CODE_MAX &&
    CUSTOM_CODE_PATTERN.test(code)
  );
}

/** Generates a cryptographically random join code (e.g. "K7P2QM"). */
export function generateJoinCode(length = JOIN_CODE_LENGTH): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let code = "";
  for (let i = 0; i < length; i++) {
    code += JOIN_CODE_ALPHABET[bytes[i] % JOIN_CODE_ALPHABET.length];
  }
  return code;
}
