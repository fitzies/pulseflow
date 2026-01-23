import crypto from "crypto";

export const SHARE_PREFIX = "pf:";
const SHARE_CODE_LENGTH = 12;
const SHARE_EXPIRY_DAYS = 30;

/**
 * Generates a random alphanumeric share code
 */
export function generateShareCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(SHARE_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Validates if a string is a valid share code format
 * Expected format: "pf:" + 12 alphanumeric characters
 */
export function isValidShareCode(shareString: string): boolean {
  if (!shareString.startsWith(SHARE_PREFIX)) {
    return false;
  }
  const code = shareString.slice(SHARE_PREFIX.length);
  if (code.length !== SHARE_CODE_LENGTH) {
    return false;
  }
  return /^[A-Za-z0-9]+$/.test(code);
}

/**
 * Extracts the share code from a full share string
 */
export function extractShareCode(shareString: string): string | null {
  if (!isValidShareCode(shareString)) {
    return null;
  }
  return shareString.slice(SHARE_PREFIX.length);
}

/**
 * Creates a full share string from a code
 */
export function createShareString(code: string): string {
  return `${SHARE_PREFIX}${code}`;
}

/**
 * Returns the expiry date for a new share code
 */
export function getShareExpiryDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + SHARE_EXPIRY_DAYS);
  return date;
}
