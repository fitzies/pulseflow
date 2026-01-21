'use client';

import {
  ArrowsRightLeftIcon,
  PaperAirplaneIcon,
  BeakerIcon,
  WalletIcon,
  CurrencyDollarIcon,
  ClockIcon,
  FireIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/solid';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { getNodeBackgroundColor, getNodeTextColor } from '@/components/nodes/node-colors';

export type NodeType =
  | 'start'
  | 'swap'
  | 'swapFromPLS'
  | 'swapToPLS'
  | 'transfer'
  | 'transferPLS'
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
  | 'loop'
  | 'gasGuard'
  | 'condition';

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
    icon: ArrowsRightLeftIcon,
    iconBg: getNodeBackgroundColor('swap'),
    iconColor: getNodeTextColor('swap'),
  },
  {
    type: 'transfer',
    label: 'Transfer',
    description: 'Send tokens to address',
    icon: PaperAirplaneIcon,
    iconBg: getNodeBackgroundColor('transfer'),
    iconColor: getNodeTextColor('transfer'),
  },
  {
    type: 'transferPLS',
    label: 'Transfer PLS',
    description: 'Send PLS to address',
    icon: PaperAirplaneIcon,
    iconBg: getNodeBackgroundColor('transferPLS'),
    iconColor: getNodeTextColor('transferPLS'),
  },
  {
    type: 'addLiquidity',
    label: 'Add Liquidity',
    description: 'Provide liquidity to pool',
    icon: BeakerIcon,
    iconBg: getNodeBackgroundColor('addLiquidity'),
    iconColor: getNodeTextColor('addLiquidity'),
  },
  {
    type: 'removeLiquidity',
    label: 'Remove Liquidity',
    description: 'Withdraw liquidity from pool',
    icon: BeakerIcon,
    iconBg: getNodeBackgroundColor('removeLiquidity'),
    iconColor: getNodeTextColor('removeLiquidity'),
  },
  {
    type: 'checkBalance',
    label: 'Check Balance',
    description: 'Get wallet PLS balance',
    icon: WalletIcon,
    iconBg: getNodeBackgroundColor('checkBalance'),
    iconColor: getNodeTextColor('checkBalance'),
  },
  {
    type: 'checkTokenBalance',
    label: 'Check Token Balance',
    description: 'Get token balance by address',
    icon: CurrencyDollarIcon,
    iconBg: getNodeBackgroundColor('checkTokenBalance'),
    iconColor: getNodeTextColor('checkTokenBalance'),
  },
  {
    type: 'swapFromPLS',
    label: 'Swap from PLS',
    description: 'Swap PLS for tokens',
    icon: ArrowsRightLeftIcon,
    iconBg: getNodeBackgroundColor('swapFromPLS'),
    iconColor: getNodeTextColor('swapFromPLS'),
  },
  {
    type: 'swapToPLS',
    label: 'Swap to PLS',
    description: 'Swap tokens for PLS',
    icon: ArrowsRightLeftIcon,
    iconBg: getNodeBackgroundColor('swapToPLS'),
    iconColor: getNodeTextColor('swapToPLS'),
  },
  {
    type: 'addLiquidityPLS',
    label: 'Add Liquidity PLS',
    description: 'Add liquidity with PLS',
    icon: BeakerIcon,
    iconBg: getNodeBackgroundColor('addLiquidityPLS'),
    iconColor: getNodeTextColor('addLiquidityPLS'),
  },
  {
    type: 'removeLiquidityPLS',
    label: 'Remove Liquidity PLS',
    description: 'Remove liquidity with PLS',
    icon: BeakerIcon,
    iconBg: getNodeBackgroundColor('removeLiquidityPLS'),
    iconColor: getNodeTextColor('removeLiquidityPLS'),
  },
  {
    type: 'burnToken',
    label: 'Burn Token',
    description: 'Burn playground token',
    icon: FireIcon,
    iconBg: getNodeBackgroundColor('burnToken'),
    iconColor: getNodeTextColor('burnToken'),
  },
  {
    type: 'claimToken',
    label: 'Claim Token',
    description: 'Claim playground token',
    icon: ArrowDownTrayIcon,
    iconBg: getNodeBackgroundColor('claimToken'),
    iconColor: getNodeTextColor('claimToken'),
  },
  {
    type: 'checkLPTokenAmounts',
    label: 'Check LP',
    description: 'Check LP token amounts',
    icon: ChartBarIcon,
    iconBg: getNodeBackgroundColor('checkLPTokenAmounts'),
    iconColor: getNodeTextColor('checkLPTokenAmounts'),
  },
  {
    type: 'wait',
    label: 'Wait',
    description: 'Delay execution',
    icon: ClockIcon,
    iconBg: getNodeBackgroundColor('wait'),
    iconColor: getNodeTextColor('wait'),
    requiresPlan: 'PRO',
  },
  {
    type: 'loop',
    label: 'Loop',
    description: 'Restart automation (1-3 times)',
    icon: ArrowPathIcon,
    iconBg: getNodeBackgroundColor('loop'),
    iconColor: getNodeTextColor('loop'),
    requiresPlan: 'PRO',
  },
  {
    type: 'gasGuard',
    label: 'Gas Guard',
    description: 'Stop if gas price too high',
    icon: ShieldCheckIcon,
    iconBg: getNodeBackgroundColor('gasGuard'),
    iconColor: getNodeTextColor('gasGuard'),
    requiresPlan: 'PRO',
  },
  {
    type: 'condition',
    label: 'Condition',
    description: 'Branch based on balance/LP',
    icon: QuestionMarkCircleIcon,
    iconBg: getNodeBackgroundColor('condition'),
    iconColor: getNodeTextColor('condition'),
    requiresPlan: 'PRO',
  },
];

interface SelectNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectNode: (nodeType: NodeType) => void;
  userPlan: 'BASIC' | 'PRO' | 'ULTRA' | null;
}

// Organize nodes into groups
const nodeGroups = {
  swaps: nodeTypes.filter((n) => ['swap', 'swapFromPLS', 'swapToPLS'].includes(n.type)),
  liquidity: nodeTypes.filter((n) =>
    ['addLiquidity', 'addLiquidityPLS', 'removeLiquidity', 'removeLiquidityPLS'].includes(n.type)
  ),
  transfers: nodeTypes.filter((n) => n.type === 'transfer' || n.type === 'transferPLS'),
  checks: nodeTypes.filter((n) =>
    ['checkBalance', 'checkTokenBalance', 'checkLPTokenAmounts'].includes(n.type)
  ),
  tokenOperations: nodeTypes.filter((n) => ['burnToken', 'claimToken'].includes(n.type)),
  controlFlow: nodeTypes.filter((n) =>
    ['wait', 'loop', 'gasGuard', 'condition'].includes(n.type)
  ),
};

const planHierarchy: Record<string, number> = {
  BASIC: 1,
  PRO: 2,
  ULTRA: 3,
};

function hasRequiredPlan(userPlan: string | null, requiredPlan: string | undefined): boolean {
  if (!requiredPlan) return true;
  if (!userPlan) return false;
  return (planHierarchy[userPlan] || 0) >= (planHierarchy[requiredPlan] || 0);
}

export function SelectNodeDialog({
  open,
  onOpenChange,
  onSelectNode,
  userPlan,
}: SelectNodeDialogProps) {
  const handleSelect = (nodeType: NodeType) => {
    onSelectNode(nodeType);
    onOpenChange(false);
  };

  const renderNodeItem = (nodeType: NodeTypeOption) => {
    const Icon = nodeType.icon;
    const isLocked = !hasRequiredPlan(userPlan, nodeType.requiresPlan);
    return (
      <CommandItem
        key={nodeType.type}
        onSelect={() => !isLocked && handleSelect(nodeType.type)}
        disabled={isLocked}
        className="flex items-center gap-3"
      >
        <div className={cn('rounded-lg p-1.5', nodeType.iconBg)}>
          <Icon className={cn('h-4 w-4', nodeType.iconColor)} />
        </div>
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-2">
            <span>{nodeType.label}</span>
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
      </CommandItem>
    );
  };

  const renderGroup = (heading: string, nodes: NodeTypeOption[], showSeparator = true) => (
    <>
      <CommandGroup heading={heading}>
        {nodes.map(renderNodeItem)}
      </CommandGroup>
      {showSeparator && <CommandSeparator />}
    </>
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Select Node Type"
      description="Choose a node type to add to your automation flow"
    >
      <CommandInput placeholder="Search nodes..." />
      <CommandList>
        <CommandEmpty>No nodes found.</CommandEmpty>

        {renderGroup('Swaps', nodeGroups.swaps)}
        {renderGroup('Liquidity', nodeGroups.liquidity)}
        {renderGroup('Transfers', nodeGroups.transfers)}
        {renderGroup('Checks', nodeGroups.checks)}
        {renderGroup('Token Operations', nodeGroups.tokenOperations)}
        {renderGroup('Control Flow', nodeGroups.controlFlow, false)}
      </CommandList>
    </CommandDialog>
  );
}
