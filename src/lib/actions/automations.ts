"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateWallet } from "@/lib/wallet-generation";

export async function createAutomation(name: string) {
  try {
    // Get authenticated user from Clerk
    const user = await currentUser();

    if (!user) {
      return {
        success: false,
        error: "Unauthorized. Please sign in.",
      };
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      return {
        success: false,
        error: "User not found. Please contact support.",
      };
    }

    // Check if user has a plan
    if (dbUser.plan === null) {
      return {
        success: false,
        error: "You need to upgrade to a plan to create automations.",
      };
    }

    // Generate wallet
    const { address, encryptedKey } = await generateWallet();

    // Create automation
    const automation = await prisma.automation.create({
      data: {
        name,
        userId: dbUser.id,
        walletAddress: address,
        walletEncKey: encryptedKey,
        definition: {},
        isActive: false,
      },
    });

    // Revalidate the automations page
    revalidatePath("/automations");

    return {
      success: true,
      automation,
    };
  } catch (error) {
    console.error("Error creating automation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create automation.",
    };
  }
}
