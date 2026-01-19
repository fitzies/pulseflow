import { Wallet } from "ethers";
import { createCipheriv, randomBytes, scryptSync } from "crypto";

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
 * Gets PulseChain network configuration
 * @returns Network configuration object
 */
export function getPulseChainNetwork() {
  return {
    chainId: PULSECHAIN_CHAIN_ID,
    name: "PulseChain",
  };
}
