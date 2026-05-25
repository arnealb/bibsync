/**
 * Alphabet for room join codes: uppercase letters + digits, excluding the
 * easily-confused characters 0/O/1/I/L.
 */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 6;

/** Generates a cryptographically random join code (e.g. "K7P2QM"). */
export function generateJoinCode(length = JOIN_CODE_LENGTH): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let code = "";
  for (let i = 0; i < length; i++) {
    code += JOIN_CODE_ALPHABET[bytes[i] % JOIN_CODE_ALPHABET.length];
  }
  return code;
}
