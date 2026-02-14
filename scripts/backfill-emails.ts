import { PrismaClient } from "@prisma/client";
import { createClerkClient } from "@clerk/backend";

const prisma = new PrismaClient();
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

async function main() {
  const users = await prisma.user.findMany({ where: { email: null } });
  console.log(`Found ${users.length} users without email`);

  let updated = 0;
  for (const user of users) {
    try {
      const clerkUser = await clerk.users.getUser(user.clerkId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (email) {
        await prisma.user.update({
          where: { id: user.id },
          data: { email },
        });
        console.log(`✅ ${user.clerkId} → ${email}`);
        updated++;
      } else {
        console.log(`⚠️  ${user.clerkId} has no email in Clerk`);
      }
    } catch (err) {
      console.error(`❌ Failed for ${user.clerkId}:`, err);
    }
  }

  console.log(`\nDone! Updated ${updated}/${users.length} users.`);
}

main().finally(() => prisma.$disconnect());
