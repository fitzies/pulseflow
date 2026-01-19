'use client';

import {
  ArrowRightLeft,
  SendHorizonal,
  TrendingUp,
  Droplet,
  DropletOff,
  Wallet,
  Coins,
  Clock,
  Flame,
  Download,
  BarChart3,
  RefreshCw,
  Shield,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type NodeType =
  | 'swap'
  | 'swapFromPLS'
  | 'swapToPLS'
  | 'transfer'
  | 'addLiquidity'
  | 'addLiquidityPLS'
  | 'removeLiquidity'
  | 'removeLiquidityPLS'
  | 'checkBalance'
  | 'checkTokenBalance'
  | 'checkLPTokenAmounts'
  | 'burnToken'
  | 'claimToken'
  | 'wait'
  | 'getTokenPrice'
  | 'loop'
  | 'gasGuard'
  | 'failureHandle'
  | 'windowedExecution';

interface NodeTypeOption {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  requiresPlan?: 'PRO' | 'ULTRA';
}

const nodeTypes: NodeTypeOption[] = [
  {
    type: 'swap',
    label: 'Swap',
    description: 'Exchange tokens',
    icon: ArrowRightLeft,
    iconBg: 'bg-amber-400/20',
    iconColor: 'text-amber-400',
  },
  {
    type: 'transfer',
    label: 'Transfer',
    description: 'Send tokens to address',
    icon: SendHorizonal,
    iconBg: 'bg-rose-400/20',
    iconColor: 'text-rose-400',
  },
  {
    type: 'addLiquidity',
    label: 'Add Liquidity',
    description: 'Provide liquidity to pool',
    icon: Droplet,
    iconBg: 'bg-blue-400/20',
    iconColor: 'text-blue-400',
  },
  {
    type: 'removeLiquidity',
    label: 'Remove Liquidity',
    description: 'Withdraw liquidity from pool',
    icon: DropletOff,
    iconBg: 'bg-orange-400/20',
    iconColor: 'text-orange-400',
  },
  {
    type: 'checkBalance',
    label: 'Check Balance',
    description: 'Get wallet PLS balance',
    icon: Wallet,
    iconBg: 'bg-purple-400/20',
    iconColor: 'text-purple-400',
  },
  {
    type: 'checkTokenBalance',
    label: 'Check Token Balance',
    description: 'Get token balance by address',
    icon: Coins,
    iconBg: 'bg-emerald-400/20',
    iconColor: 'text-emerald-400',
  },
  {
    type: 'swapFromPLS',
    label: 'Swap from PLS',
    description: 'Swap PLS for tokens',
    icon: ArrowRightLeft,
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-500',
  },
  {
    type: 'swapToPLS',
    label: 'Swap to PLS',
    description: 'Swap tokens for PLS',
    icon: ArrowRightLeft,
    iconBg: 'bg-amber-400/20',
    iconColor: 'text-amber-400',
  },
  {
    type: 'addLiquidityPLS',
    label: 'Add Liquidity PLS',
    description: 'Add liquidity with PLS',
    icon: Droplet,
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-500',
  },
  {
    type: 'removeLiquidityPLS',
    label: 'Remove Liquidity PLS',
    description: 'Remove liquidity with PLS',
    icon: DropletOff,
    iconBg: 'bg-orange-500/20',
    iconColor: 'text-orange-500',
  },
  {
    type: 'burnToken',
    label: 'Burn Token',
    description: 'Burn playground token',
    icon: Flame,
    iconBg: 'bg-red-400/20',
    iconColor: 'text-red-400',
  },
  {
    type: 'claimToken',
    label: 'Claim Token',
    description: 'Claim playground token',
    icon: Download,
    iconBg: 'bg-indigo-400/20',
    iconColor: 'text-indigo-400',
  },
  {
    type: 'checkLPTokenAmounts',
    label: 'Check LP Amounts',
    description: 'Check LP token amounts',
    icon: BarChart3,
    iconBg: 'bg-teal-400/20',
    iconColor: 'text-teal-400',
  },
  {
    type: 'wait',
    label: 'Wait',
    description: 'Delay execution',
    icon: Clock,
    iconBg: 'bg-cyan-400/20',
    iconColor: 'text-cyan-400',
    requiresPlan: 'PRO',
  },
  {
    type: 'getTokenPrice',
    label: 'Get Token Price',
    description: 'Get token price from DEX',
    icon: TrendingUp,
    iconBg: 'bg-green-400/20',
    iconColor: 'text-green-400',
    requiresPlan: 'PRO',
  },
  {
    type: 'loop',
    label: 'Loop',
    description: 'Loop automation',
    icon: RefreshCw,
    iconBg: 'bg-violet-400/20',
    iconColor: 'text-violet-400',
    requiresPlan: 'PRO',
  },
  {
    type: 'gasGuard',
    label: 'Gas Guard',
    description: 'Stop if gas too high',
    icon: Shield,
    iconBg: 'bg-yellow-400/20',
    iconColor: 'text-yellow-400',
    requiresPlan: 'PRO',
  },
  {
    type: 'failureHandle',
    label: 'Failure Handle',
    description: 'Route on failure',
    icon: AlertCircle,
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-500',
    requiresPlan: 'PRO',
  },
  {
    type: 'windowedExecution',
    label: 'Windowed Execution',
    description: 'Execute within time window',
    icon: Calendar,
    iconBg: 'bg-blue-600/20',
    iconColor: 'text-blue-600',
    requiresPlan: 'PRO',
  },
];

interface SelectNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectNode: (nodeType: NodeType) => void;
}

export function SelectNodeDialog({
  open,
  onOpenChange,
  onSelectNode,
}: SelectNodeDialogProps) {
  const handleSelect = (nodeType: NodeType) => {
    onSelectNode(nodeType);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Node Type</DialogTitle>
          <DialogDescription>
            Choose a node type to add to your automation flow
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-4">
          {nodeTypes.map((nodeType) => {
            const Icon = nodeType.icon;
            const isLocked = !!nodeType.requiresPlan;
            return (
              <Button
                key={nodeType.type}
                variant="outline"
                className={cn(
                  'h-auto flex-col items-start gap-2 p-4',
                  isLocked 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-accent',
                )}
                onClick={() => !isLocked && handleSelect(nodeType.type)}
                disabled={isLocked}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className={cn('rounded-xl p-1.5', nodeType.iconBg)}>
                    <Icon className={cn('h-4 w-4', nodeType.iconColor)} />
                  </div>
                  <div className="flex flex-col items-start flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{nodeType.label}</span>
                      {nodeType.requiresPlan && (
                        <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          {nodeType.requiresPlan}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {nodeType.description}
                    </span>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
