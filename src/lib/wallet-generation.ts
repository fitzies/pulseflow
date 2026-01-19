import { Wallet } from "ethers";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const PULSECHAIN_CHAIN_ID = 369;

/**
 * Generates a new PulseChain wallet
 * @returns Object containing wallet address and encrypted private key
 */
export async function generateWallet(): Promise<{
  address: string;
  encryptedKey: string;
}> {
  // Create a new random wallet
  const wallet = Wallet.createRandom();

  // Get the wallet address
  const address = wallet.address;

  // Encrypt the private key
  const encryptedKey = await encryptPrivateKey(
    wallet.privateKey,
    process.env.WALLET_ENCRYPTION_PASSWORD || "default-password-change-in-production"
  );

  return {
    address,
    encryptedKey,
  };
}

/**
 * Encrypts a private key using AES-256-GCM
 * @param privateKey - The private key to encrypt
 * @param password - Password for encryption
 * @returns Encrypted private key as hex string
 */
async function encryptPrivateKey(
  privateKey: string,
  password: string
): Promise<string> {
  // Generate salt and IV
  const salt = randomBytes(16);
  const iv = randomBytes(16);

  // Derive key from password using scrypt
  const key = scryptSync(password, salt, 32);

  // Create cipher
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  // Encrypt the private key
  let encrypted = cipher.update(privateKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Get auth tag for GCM
  const authTag = cipher.getAuthTag();

  // Combine salt, iv, authTag, and encrypted data
  const combined = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, "hex"),
  ]);

  return combined.toString("hex");
}

/**
 * Decrypts an encrypted private key using AES-256-GCM
 * @param encryptedKey - The encrypted private key as hex string
 * @param password - Password for decryption
 * @returns Decrypted private key
 */
export function decryptPrivateKey(
  encryptedKey: string,
  password: string = process.env.WALLET_ENCRYPTION_PASSWORD || "default-password-change-in-production"
): string {
  // Convert hex string to buffer
  const combined = Buffer.from(encryptedKey, "hex");

  // Extract salt, iv, authTag, and encrypted data
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 32);
  const authTag = combined.slice(32, 48);
  const encrypted = combined.slice(48);

  // Derive key from password using scrypt
  const key = scryptSync(password, salt, 32);

  // Create decipher
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt the private key
  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Gets a Wallet instance from an encrypted private key
 * @param encryptedKey - The encrypted private key
 * @param password - Optional password (defaults to env var)
 * @returns Wallet instance
 */
export function getWalletFromEncryptedKey(
  encryptedKey: string,
  password?: string
): Wallet {
  const privateKey = decryptPrivateKey(encryptedKey, password);
  return new Wallet(privateKey);
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
