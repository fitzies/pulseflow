import { cn } from '@/lib/utils';
import { BaseNode } from '@/components/base-node';
import type { NodeStatus } from '@/components/node-status-indicator';

interface NodeCardWithStatusProps {
  status?: NodeStatus;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

const StatusOverlay = ({ status }: { status: Exclude<NodeStatus, 'initial'> }) => (
  <div
    className={cn(
      'absolute inset-0 pointer-events-none z-10 rounded-[calc(var(--radius)-2px)]',
      status === 'loading' && 'node-status-loading',
      status === 'success' && 'ring-2 ring-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]',
      status === 'error' && 'ring-2 ring-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]',
    )}
  />
);

export function NodeCardWithStatus({ status = 'initial', className, onClick, children }: NodeCardWithStatusProps) {
  return (
    <div className="relative">
      <BaseNode className={className} onClick={onClick}>
        {children}
      </BaseNode>
      {status !== 'initial' && <StatusOverlay status={status} />}
    </div>
  );
}
