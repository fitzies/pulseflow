import { Wallet } from "ethers";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const PULSECHAIN_CHAIN_ID = 369;

/**
 * Encrypted key formats
 *
 * v2 (current): "v2:" + hex(iv[12] | authTag[16] | ciphertext)
 *   AES-256-GCM with the random 32-byte key in WALLET_ENCRYPTION_KEY (64 hex chars).
 *
 * legacy: hex(salt[16] | iv[16] | authTag[16] | ciphertext)
 *   AES-256-GCM with a scrypt key derived from WALLET_ENCRYPTION_PASSWORD, which
 *   fell back to a default string that is public in this repo. Legacy rows are
 *   read-only: run scripts/migrate-wallet-encryption.ts to convert them to v2,
 *   then delete the legacy path below.
 */
const V2_PREFIX = "v2:";
const LEGACY_DEFAULT_PASSWORD = "default-password-change-in-production";

function getEncryptionKey(): Buffer {
  const hex = process.env.WALLET_ENCRYPTION_KEY?.trim();
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("WALLET_ENCRYPTION_KEY must be set to 32 random bytes as 64 hex characters");
  }
  return Buffer.from(hex, "hex");
}

function getLegacyPassword(): string {
  return process.env.WALLET_ENCRYPTION_PASSWORD || LEGACY_DEFAULT_PASSWORD;
}

export function isLegacyEncryptedKey(encryptedKey: string): boolean {
  return !encryptedKey.startsWith(V2_PREFIX);
}

/**
 * Generates a new PulseChain wallet
 * @returns Object containing wallet address and encrypted private key
 */
export async function generateWallet(): Promise<{
  address: string;
  encryptedKey: string;
}> {
  const wallet = Wallet.createRandom();
  return {
    address: wallet.address,
    encryptedKey: encryptPrivateKey(wallet.privateKey),
  };
}

/**
 * Encrypts a private key in the v2 format. Throws if WALLET_ENCRYPTION_KEY is missing.
 */
export function encryptPrivateKey(privateKey: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return V2_PREFIX + Buffer.concat([iv, authTag, encrypted]).toString("hex");
}

/**
 * Decrypts a private key stored in either the v2 or the legacy format.
 */
export function decryptPrivateKey(encryptedKey: string): string {
  if (!isLegacyEncryptedKey(encryptedKey)) {
    const combined = Buffer.from(encryptedKey.slice(V2_PREFIX.length), "hex");
    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(12, 28);
    const encrypted = combined.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }
  return decryptLegacyPrivateKey(encryptedKey, getLegacyPassword());
}

/**
 * Legacy format only. Remove once every row has been migrated to v2.
 */
export function decryptLegacyPrivateKey(encryptedKey: string, password: string): string {
  const combined = Buffer.from(encryptedKey, "hex");
  const salt = combined.subarray(0, 16);
  const iv = combined.subarray(16, 32);
  const authTag = combined.subarray(32, 48);
  const encrypted = combined.subarray(48);
  const key = scryptSync(password, salt, 32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/**
 * Gets a Wallet instance from an encrypted private key
 */
export function getWalletFromEncryptedKey(encryptedKey: string): Wallet {
  return new Wallet(decryptPrivateKey(encryptedKey));
}

/**
 * Gets PulseChain network configuration
 * @returns Network configuration object
 */
export function getPulseChainNetwork() {
  return {
    chainId: PULSECHAIN_CHAIN_ID,
    name: "PulseChain",
  };
}
