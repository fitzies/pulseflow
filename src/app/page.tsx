import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma, getOrCreateDbUser } from "@/lib/prisma";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { PlanCard } from "./plans/page";
import { plans } from "@/lib/plan-limits";
import { Plan } from "@prisma/client";
import Footer from "@/components/footer";

export default async function Page() {
  const user = await currentUser();

  if (user) {
    // Get or create user in database and redirect to automations
    await getOrCreateDbUser(user.id);
    redirect("/automations");
  }


  return <main className="flex flex-col gap-20 pb-8">
    <Hero />
    <Features />
    {/* <div className="flex flex-col md:flex-row gap-6 max-w-5xl w-full mx-auto">
      <PlanCard plan="BASIC" features={plans.BASIC} currentPlan={null} />
      <PlanCard plan="PRO" features={plans.PRO} currentPlan={null} />
      <PlanCard plan="ULTRA" features={plans.ULTRA} currentPlan={null} />
    </div> */}
    <Footer />
  </main>
}