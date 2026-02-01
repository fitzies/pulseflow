'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SlippageSelector } from '@/components/slippage-selector';
import { toast } from 'sonner';
import { Cog6ToothIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';

interface AutomationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automationId: string;
  initialName: string;
  initialDefaultSlippage: number;
  initialRpcEndpoint: string | null;
  initialShowNodeLabels: boolean;
  initialBetaFeatures: boolean;
  initialCommunityVisible: boolean;
  userPlan: 'BASIC' | 'PRO' | 'ULTRA' | null;
  onSettingsUpdate?: () => void;
  onReset?: () => void;
  onDelete?: () => void;
}

export function AutomationSettingsDialog({
  open,
  onOpenChange,
  automationId,
  initialName,
  initialDefaultSlippage,
  initialRpcEndpoint,
  initialShowNodeLabels,
  initialBetaFeatures,
  initialCommunityVisible,
  userPlan,
  onSettingsUpdate,
  onReset,
  onDelete,
}: AutomationSettingsDialogProps) {
  const [name, setName] = useState(initialName);
  const [defaultSlippage, setDefaultSlippage] = useState(initialDefaultSlippage);
  const [rpcEndpoint, setRpcEndpoint] = useState(initialRpcEndpoint || 'https://rpc.pulsechain.com');
  const [showNodeLabels, setShowNodeLabels] = useState(initialShowNodeLabels);
  const [betaFeatures, setBetaFeatures] = useState(initialBetaFeatures);
  const [communityVisible, setCommunityVisible] = useState(initialCommunityVisible);
  const [isSaving, setIsSaving] = useState(false);
  const [showPrivateKeyDialog, setShowPrivateKeyDialog] = useState(false);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [isLoadingPrivateKey, setIsLoadingPrivateKey] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDefaultSlippage(initialDefaultSlippage);
      setRpcEndpoint(initialRpcEndpoint || 'https://rpc.pulsechain.com');
      setShowNodeLabels(initialShowNodeLabels);
      setBetaFeatures(initialBetaFeatures);
      setCommunityVisible(initialCommunityVisible);
      setPrivateKey(null);
    }
  }, [open, initialName, initialDefaultSlippage, initialRpcEndpoint, initialShowNodeLabels, initialBetaFeatures, initialCommunityVisible]);

  const isProUser = userPlan === 'PRO' || userPlan === 'ULTRA';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/automations/${automationId}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          defaultSlippage,
          rpcEndpoint: isProUser ? rpcEndpoint : undefined,
          showNodeLabels,
          betaFeatures,
          communityVisible
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }

      toast.success('Settings updated successfully');
      onSettingsUpdate?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevealPrivateKey = async () => {
    setIsLoadingPrivateKey(true);
    try {
      const response = await fetch(`/api/automations/${automationId}/private-key`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get private key');
      }
      const data = await response.json();
      setPrivateKey(data.privateKey);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to get private key');
      setShowPrivateKeyDialog(false);
    } finally {
      setIsLoadingPrivateKey(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Automation Settings</DialogTitle>
            <DialogDescription>
              Configure your automation settings and preferences.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Name */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Automation name"
              />
            </div>

            {/* Default Slippage */}
            <div>
              <SlippageSelector
                value={defaultSlippage}
                onChange={setDefaultSlippage}
                showNodePrecedenceMessage={true}
              />
            </div>

            {/* RPC Endpoint */}
            <div className="space-y-2">
              <label htmlFor="rpcEndpoint" className="text-sm font-medium">
                RPC Endpoint
                {!isProUser && (
                  <span className="ml-2 text-xs text-muted-foreground">(PRO feature)</span>
                )}
              </label>
              <Input
                id="rpcEndpoint"
                value={rpcEndpoint}
                onChange={(e) => setRpcEndpoint(e.target.value)}
                placeholder="https://rpc.pulsechain.com"
                disabled={!isProUser}
              />
              {!isProUser && (
                <div className="text-xs text-muted-foreground">
                  Upgrade to PRO to use custom RPC endpoints
                </div>
              )}
            </div>

            {/* Node Labels Toggle */}
            {/* <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label htmlFor="showNodeLabels" className="text-sm font-medium">
                  Show Node Labels
                </label>
                <div className="text-xs text-muted-foreground">
                  Toggle visibility of node names in the flow
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNodeLabels(!showNodeLabels)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  showNodeLabels ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    showNodeLabels ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div> */}

            {/* Beta Features Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label htmlFor="betaFeatures" className="text-sm font-medium">
                  Beta Features
                </label>
                <div className="text-xs text-muted-foreground">
                  Enable experimental features like AI chat
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBetaFeatures(!betaFeatures)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  betaFeatures ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    betaFeatures ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label htmlFor="communityVisible" className="text-sm font-medium">
                  Community Visible
                </label>
                <div className="text-xs text-muted-foreground">
                  Visible to other users (wallet details remain private)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCommunityVisible(!communityVisible)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  communityVisible ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    communityVisible ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {/* Reveal Private Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Private Key</label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPrivateKeyDialog(true)}
                className="w-full mt-1"
              >
                {privateKey ? (
                  <>
                    <EyeSlashIcon className="h-4 w-4 mr-2" />
                    Hide Private Key
                  </>
                ) : (
                  <>
                    <EyeIcon className="h-4 w-4 mr-2" />
                    Reveal Private Key
                  </>
                )}
              </Button>
              {privateKey && (
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <div className="text-xs text-muted-foreground mb-1">Private Key:</div>
                  <div className="text-xs font-mono break-all">{privateKey}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(privateKey);
                      toast.success('Private key copied to clipboard');
                    }}
                    className="mt-2"
                  >
                    Copy
                  </Button>
                </div>
              )}
            </div>

            {/* Reset Automation */}
            <div className="space-y-2 border-t pt-4">
              <label className="text-sm font-medium text-destructive">Danger Zone</label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowResetDialog(true)}
                  className="flex-1"
                >
                  Reset Automation
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  className="flex-1"
                >
                  Delete Automation
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Private Key Confirmation Dialog */}
      <AlertDialog open={showPrivateKeyDialog} onOpenChange={setShowPrivateKeyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Revealing your private key is a security risk. Anyone with access to this key can
              control your automation wallet. Make sure you're in a secure environment and never
              share this key with anyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevealPrivateKey}
              disabled={isLoadingPrivateKey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoadingPrivateKey ? 'Loading...' : 'Yes, Reveal Private Key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Automation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all nodes except the start node. All your automation configuration
              will be lost. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onReset?.();
                setShowResetDialog(false);
                onOpenChange(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Reset Automation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Automation?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div>
                This will permanently delete this automation and all its data. This action cannot be undone.
              </div>
              <div className="font-semibold text-destructive">
                ⚠️ Make sure there are no funds in the automation wallet before proceeding.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete?.();
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Delete Automation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
