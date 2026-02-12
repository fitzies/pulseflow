'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SlippageSelector } from '@/components/slippage-selector';
import { toast } from 'sonner';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';
import { ArrowLeft } from 'lucide-react';
import { updateAutomationDefinition } from '@/lib/actions/automations';

function SettingRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 py-3">{children}</div>;
}

function SettingLabel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-sm font-medium text-foreground">{title}</Label>
      <p className="text-[13px] text-muted-foreground">{description}</p>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {title}
    </h2>
  );
}

const RPC_ENDPOINTS = [
  { value: 'https://rpc.pulsechain.com', label: 'rpc.pulsechain.com' },
  { value: 'https://rpc-pulsechain.g4mm4.io', label: 'rpc-pulsechain.g4mm4.io' },
  { value: 'https://rpc.pulsechainstats.com', label: 'rpc.pulsechainstats.com' },
  { value: 'https://rpc.pulsechainrpc.com', label: 'rpc.pulsechainrpc.com' },
  { value: 'https://pulsechain-rpc.publicnode.com', label: 'pulsechain-rpc.publicnode.com' },
];

const defaultStartNode = [
  {
    id: 'start-1',
    position: { x: 0, y: 0 },
    data: {},
    type: 'start',
  },
];

interface AutomationSettingsFormProps {
  automationId: string;
  initialName: string;
  initialDefaultSlippage: number;
  initialRpcEndpoint: string | null;
  initialShowNodeLabels: boolean;
  initialBetaFeatures: boolean;
  initialCommunityVisible: boolean;
  userPlan: 'BASIC' | 'PRO' | 'ULTRA' | null;
}

export function AutomationSettingsForm({
  automationId,
  initialName,
  initialDefaultSlippage,
  initialRpcEndpoint,
  initialShowNodeLabels,
  initialBetaFeatures,
  initialCommunityVisible,
  userPlan,
}: AutomationSettingsFormProps) {
  const router = useRouter();
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
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isProUser = userPlan === 'PRO' || userPlan === 'ULTRA';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/automations/${automationId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          defaultSlippage,
          rpcEndpoint: isProUser ? rpcEndpoint : undefined,
          showNodeLabels,
          betaFeatures,
          communityVisible,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }

      toast.success('Settings updated successfully');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevealPrivateKey = async () => {
    setIsLoadingPrivateKey(true);
    setPasswordError(null);
    try {
      const response = await fetch(`/api/automations/${automationId}/private-key`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get private key');
      }
      const data = await response.json();

      if (data.requiresPassword) {
        setRequiresPassword(true);
        setIsLoadingPrivateKey(false);
        return;
      }

      setPrivateKey(data.privateKey);
      setShowPrivateKeyDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to get private key');
      setShowPrivateKeyDialog(false);
    } finally {
      setIsLoadingPrivateKey(false);
    }
  };

  const handleSubmitPassword = async () => {
    if (!passwordInput.trim()) {
      setPasswordError('Please enter your password');
      return;
    }

    setIsLoadingPrivateKey(true);
    setPasswordError(null);
    try {
      const response = await fetch(`/api/automations/${automationId}/private-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 401) {
          setPasswordError('Invalid password. Please try again.');
          return;
        }
        throw new Error(error.error || 'Failed to verify password');
      }

      const data = await response.json();
      setPrivateKey(data.privateKey);
      setShowPrivateKeyDialog(false);
      setRequiresPassword(false);
      setPasswordInput('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to get private key');
    } finally {
      setIsLoadingPrivateKey(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    setShowResetDialog(false);
    try {
      const result = await updateAutomationDefinition(automationId, defaultStartNode, []);
      if (!result.success) {
        throw new Error(result.error);
      }
      toast.success('Automation reset - all nodes except start node removed');
      router.push(`/automations/${automationId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reset automation');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setShowDeleteDialog(false);
    try {
      const response = await fetch(`/api/automations/${automationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete automation');
      }

      toast.success('Automation deleted successfully');
      router.push('/automations');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete automation');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure your automation settings and preferences.
        </p>
      </div>

      <Separator className="my-8" />

      {/* General */}
      <section className="space-y-4">
        <SectionHeader title="General" />
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm text-foreground">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Automation name"
            />
          </div>
          <div className="space-y-2">
            <SlippageSelector
              value={defaultSlippage}
              onChange={setDefaultSlippage}
              showNodePrecedenceMessage={true}
            />
          </div>
        </div>
      </section>

      <Separator className="my-8" />

      {/* Network */}
      <section className="space-y-4">
        <SectionHeader title="Network" />
        <div className="space-y-1">
          <SettingRow>
            <SettingLabel
              title="RPC Endpoint"
              description={
                isProUser
                  ? 'Select your preferred PulseChain RPC endpoint.'
                  : 'Upgrade to PRO to use custom RPC endpoints.'
              }
            />
            <Select
              value={rpcEndpoint}
              onValueChange={setRpcEndpoint}
              disabled={!isProUser}
            >
              <SelectTrigger className="w-[180px]" aria-label="Select RPC endpoint">
                <SelectValue placeholder="Select RPC endpoint" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {RPC_ENDPOINTS.map((rpc) => (
                    <SelectItem key={rpc.value} value={rpc.value}>
                      {rpc.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      </section>

      <Separator className="my-8" />

      {/* Preferences */}
      <section className="space-y-4">
        <SectionHeader title="Preferences" />
        <div className="space-y-1">
          <SettingRow>
            <SettingLabel
              title="Beta Features"
              description="Enable experimental features like AI chat."
            />
            <button
              type="button"
              role="switch"
              aria-checked={betaFeatures}
              aria-label="Toggle beta features"
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
          </SettingRow>
          <SettingRow>
            <SettingLabel
              title="Community Visible"
              description="Visible to other users (wallet details remain private)."
            />
            <button
              type="button"
              role="switch"
              aria-checked={communityVisible}
              aria-label="Toggle community visible"
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
          </SettingRow>
        </div>
      </section>

      <Separator className="my-8" />

      {/* Security */}
      <section className="space-y-4">
        <SectionHeader title="Security" />
        <div className="space-y-2">
          <SettingLabel
            title="Private Key"
            description="Reveal your automation wallet private key. Keep this secure and never share it."
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => (privateKey ? setPrivateKey(null) : setShowPrivateKeyDialog(true))}
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
      </section>

      <Separator className="my-8" />

      {/* Danger zone */}
      <section className="space-y-4">
        <SectionHeader title="Danger zone" />
        <div className="space-y-1">
          <SettingRow>
            <SettingLabel
              title="Reset Automation"
              description="Delete all nodes except the start node. This action cannot be undone."
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowResetDialog(true)}
              disabled={isResetting}
            >
              Reset
            </Button>
          </SettingRow>
          <SettingRow>
            <SettingLabel
              title="Delete Automation"
              description="Permanently delete this automation and all its data. Ensure no funds remain in the wallet."
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </SettingRow>
        </div>
      </section>

      <Separator className="my-8" />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>

      {/* Private Key Confirmation Dialog */}
      <AlertDialog
        open={showPrivateKeyDialog}
        onOpenChange={(open) => {
          setShowPrivateKeyDialog(open);
          if (!open) {
            setRequiresPassword(false);
            setPasswordInput('');
            setPasswordError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {requiresPassword ? 'Enter Your Password' : 'Are you sure?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {requiresPassword ? (
                'Your account has password protection enabled. Please enter your password to reveal the private key.'
              ) : (
                "Revealing your private key is a security risk. Anyone with access to this key can control your automation wallet. Make sure you're in a secure environment and never share this key with anyone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {requiresPassword && (
            <div className="py-2">
              <Input
                type="password"
                placeholder="Enter your password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmitPassword();
                  }
                }}
                disabled={isLoadingPrivateKey}
              />
              {passwordError && (
                <p className="text-sm text-destructive mt-2">{passwordError}</p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {requiresPassword ? (
              <Button
                onClick={handleSubmitPassword}
                disabled={isLoadingPrivateKey}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isLoadingPrivateKey ? 'Verifying...' : 'Verify & Reveal'}
              </Button>
            ) : (
              <AlertDialogAction
                onClick={handleRevealPrivateKey}
                disabled={isLoadingPrivateKey}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isLoadingPrivateKey ? 'Loading...' : 'Yes, Reveal Private Key'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Automation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all nodes except the start node. All your automation
              configuration will be lost. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={isResetting}
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
                This will permanently delete this automation and all its data. This action
                cannot be undone.
              </div>
              <div className="font-semibold text-destructive">
                Make sure there are no funds in the automation wallet before proceeding.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Delete Automation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
