import { currentUser } from '@clerk/nextjs/server';
import { prisma, getOrCreateDbUser } from '@/lib/prisma';
import { AutomationSettingsForm } from '@/components/automation-settings-form';

interface PageProps {
  params: Promise<{ automation: string }>;
}

export default async function Page({ params }: PageProps) {
  const { automation: automationId } = await params;
  const user = await currentUser();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Please sign in to view your automation.</p>
      </div>
    );
  }

  const dbUser = await getOrCreateDbUser(user.id, user.emailAddresses[0]?.emailAddress);

  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
  });

  if (!automation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Automation not found.</p>
      </div>
    );
  }

  if (automation.userId !== dbUser.id) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>You don&apos;t have permission to view this automation.</p>
      </div>
    );
  }

  return (
    <AutomationSettingsForm
      automationId={automation.id}
      initialName={automation.name}
      initialDefaultSlippage={automation.defaultSlippage ?? 0.01}
      initialRpcEndpoint={automation.rpcEndpoint}
      initialShowNodeLabels={automation.showNodeLabels ?? true}
      initialBetaFeatures={automation.betaFeatures ?? false}
      initialCommunityVisible={automation.communityVisible ?? false}
      userPlan={dbUser.plan}
    />
  );
}
