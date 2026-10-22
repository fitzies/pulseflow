/**
 * Re-encrypts every legacy automation wallet key with WALLET_ENCRYPTION_KEY (v2 format).
 *
 * Dry run (default): decrypts, re-encrypts and verifies every row in memory, writes nothing.
 *   pnpm tsx scripts/migrate-wallet-encryption.ts
 * Apply:
 *   pnpm tsx scripts/migrate-wallet-encryption.ts --apply
 *
 * Needs DATABASE_URL and WALLET_ENCRYPTION_KEY, plus WALLET_ENCRYPTION_PASSWORD if the
 * legacy rows used a non-default password. Never prints key material.
 *
 * Before --apply: create a Neon branch of production as a snapshot, and make sure both
 * Vercel and the Railway worker are running code that reads v2 keys.
 */
import { PrismaClient } from "@prisma/client";
import { Wallet } from "ethers";
import {
  decryptLegacyPrivateKey,
  decryptPrivateKey,
  encryptPrivateKey,
  isLegacyEncryptedKey,
} from "../src/lib/wallet-generation";

const apply = process.argv.includes("--apply");
const legacyPassword = process.env.WALLET_ENCRYPTION_PASSWORD || "default-password-change-in-production";

async function main() {
  const db = new PrismaClient();
  const rows = await db.automation.findMany({
    select: { id: true, walletAddress: true, walletEncKey: true },
  });

  let migrated = 0;
  let alreadyV2 = 0;
  const failures: string[] = [];

  for (const row of rows) {
    if (!isLegacyEncryptedKey(row.walletEncKey)) {
      alreadyV2++;
      continue;
    }
    try {
      const privateKey = decryptLegacyPrivateKey(row.walletEncKey, legacyPassword);
      if (new Wallet(privateKey).address.toLowerCase() !== row.walletAddress.toLowerCase()) {
        throw new Error("decrypted key does not match walletAddress");
      }
      const reEncrypted = encryptPrivateKey(privateKey);
      if (decryptPrivateKey(reEncrypted) !== privateKey) {
        throw new Error("v2 round trip failed");
      }
      if (apply) {
        // Only overwrite the exact value we read, so a concurrent change is never clobbered.
        const result = await db.automation.updateMany({
          where: { id: row.id, walletEncKey: row.walletEncKey },
          data: { walletEncKey: reEncrypted },
        });
        if (result.count !== 1) throw new Error("row changed during migration, skipped");
      }
      migrated++;
      console.log(`${apply ? "migrated" : "ok (dry run)"} ${row.id} ${row.walletAddress}`);
    } catch (error) {
      failures.push(row.id);
      console.error(`FAILED ${row.id} ${row.walletAddress}: ${(error as Error).message}`);
    }
  }

  console.log(
    `\n${apply ? "Applied" : "Dry run"}: ${migrated} ${apply ? "migrated" : "ready"}, ${alreadyV2} already v2, ${failures.length} failed, ${rows.length} total`
  );
  await db.$disconnect();
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
