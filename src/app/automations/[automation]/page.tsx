import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { AutomationFlow } from '@/components/automation-flow';
import type { Node, Edge } from '@xyflow/react';

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

  // Get user from database
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
  });

  if (!dbUser) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>User not found. Please contact support.</p>
      </div>
    );
  }

  // Fetch automation from database
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

  // Verify automation belongs to user
  if (automation.userId !== dbUser.id) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>You don't have permission to view this automation.</p>
      </div>
    );
  }

  // Check for any active (RUNNING) execution
  const activeExecution = await prisma.execution.findFirst({
    where: {
      automationId: automationId,
      status: 'RUNNING',
    },
    orderBy: { startedAt: 'desc' },
  });

  // Parse definition JSON for nodes and edges
  let initialNodes: Node[] = [];
  let initialEdges: Edge[] = [];

  if (automation.definition && typeof automation.definition === 'object') {
    const definition = automation.definition as { nodes?: Node[]; edges?: Edge[] };
    initialNodes = definition.nodes || [];
    initialEdges = definition.edges || [];
  }

  return (
    <AutomationFlow
      initialNodes={initialNodes}
      initialEdges={initialEdges}
      automationId={automation.id}
      walletAddress={automation.walletAddress}
      automationName={automation.name}
      userPlan={dbUser.plan}
      defaultSlippage={automation.defaultSlippage ?? 0.01}
      rpcEndpoint={automation.rpcEndpoint}
      showNodeLabels={automation.showNodeLabels ?? true}
      activeExecution={activeExecution ? { id: activeExecution.id, status: activeExecution.status } : null}
    />
  );
}
