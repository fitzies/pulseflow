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
  PlayIcon,
} from '@heroicons/react/24/solid';
import { MessageCircle } from 'lucide-react';
import { getNodeBackgroundColor, getNodeTextColor } from '@/components/nodes/node-colors';
import type { Node } from '@xyflow/react';

// Map node types to their icons
const nodeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  start: PlayIcon,
  swap: ArrowsRightLeftIcon,
  swapFromPLS: ArrowsRightLeftIcon,
  swapToPLS: ArrowsRightLeftIcon,
  transfer: PaperAirplaneIcon,
  transferPLS: PaperAirplaneIcon,
  addLiquidity: BeakerIcon,
  addLiquidityPLS: BeakerIcon,
  removeLiquidity: BeakerIcon,
  removeLiquidityPLS: BeakerIcon,
  checkBalance: WalletIcon,
  checkTokenBalance: CurrencyDollarIcon,
  checkLPTokenAmounts: ChartBarIcon,
  burnToken: FireIcon,
  claimToken: ArrowDownTrayIcon,
  wait: ClockIcon,
  loop: ArrowPathIcon,
  gasGuard: ShieldCheckIcon,
  condition: QuestionMarkCircleIcon,
  telegram: MessageCircle,
};

interface AutomationNodeIconsProps {
  definition: any;
}

export function AutomationNodeIcons({ definition }: AutomationNodeIconsProps) {
  const getNodeIcons = (): Array<{ type: string; icon: React.ComponentType<{ className?: string }> }> => {
    try {
      const parsed = typeof definition === 'string' ? JSON.parse(definition) : definition;
      const nodes: Node[] = parsed?.nodes || [];

      return nodes
        .filter((node) => node.type && nodeIconMap[node.type])
        .map((node) => ({
          type: node.type!,
          icon: nodeIconMap[node.type!],
        }));
    } catch {
      return [];
    }
  };

  const nodeIcons = getNodeIcons().slice(0, 8);

  return (
    <div className="grid grid-cols-4 grid-rows-2 gap-1.5 w-full h-full px-2 py-2">
      {nodeIcons.map((node, idx) => {
        const Icon = node.icon;
        return (
          <div
            key={idx}
            className={`flex items-center justify-center rounded p-1 ${getNodeBackgroundColor(node.type as any)}`}
          >
            <Icon className={`h-3 w-3 ${getNodeTextColor(node.type as any)}`} />
          </div>
        );
      })}
    </div>
  );
}
