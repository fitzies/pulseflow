import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function Page() {
  const user = await currentUser();

  if (user) {
    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    // If user is logged in and has an account, redirect to automations
    if (dbUser) {
      redirect("/automations");
    }
  }

  return <></>;
}