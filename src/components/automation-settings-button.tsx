"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cog6ToothIcon } from "@heroicons/react/24/solid";
import { toast } from "sonner";
import { AutomationSettingsDialog } from "@/components/automation-settings-dialog";

interface AutomationSettingsButtonProps {
  automationId: string;
  initialName: string;
  initialDefaultSlippage: number;
  initialRpcEndpoint: string | null;
  initialShowNodeLabels: boolean;
  initialBetaFeatures: boolean;
  initialCommunityVisible: boolean;
  userPlan: 'BASIC' | 'PRO' | 'ULTRA' | null;
}

export function AutomationSettingsButton({
  automationId,
  initialName,
  initialDefaultSlippage,
  initialRpcEndpoint,
  initialShowNodeLabels,
  initialBetaFeatures,
  initialCommunityVisible,
  userPlan,
}: AutomationSettingsButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSettingsUpdate = () => {
    router.refresh();
  };

  const handleReset = async () => {
    // Reset is typically done from within the flow editor
    // For now, we'll redirect to the automation page where reset can be done
    router.push(`/automations/${automationId}`);
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/automations/${automationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete automation');
      }

      toast.success('Automation deleted successfully');
      router.push("/automations");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete automation');
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1 rounded hover:bg-muted transition-colors"
        title="Settings"
      >
        <Cog6ToothIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
      </button>
      <AutomationSettingsDialog
        open={open}
        onOpenChange={setOpen}
        automationId={automationId}
        initialName={initialName}
        initialDefaultSlippage={initialDefaultSlippage}
        initialRpcEndpoint={initialRpcEndpoint}
        initialShowNodeLabels={initialShowNodeLabels}
        initialBetaFeatures={initialBetaFeatures}
        initialCommunityVisible={initialCommunityVisible}
        userPlan={userPlan}
        onSettingsUpdate={handleSettingsUpdate}
        onReset={handleReset}
        onDelete={handleDelete}
      />
    </>
  );
}
