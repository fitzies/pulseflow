import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type NodeStatus = 'initial' | 'loading' | 'success' | 'error';

interface NodeStatusIndicatorProps extends ComponentProps<'div'> {
  status: NodeStatus;
  children: ReactNode;
}

export function NodeStatusIndicator({
  status,
  children,
  className,
  ...props
}: NodeStatusIndicatorProps) {
  return (
    <div className={cn('relative', className)} {...props}>
      {/* Status border overlay */}
      {status !== 'initial' && (
        <div
          className={cn(
            'absolute inset-0 pointer-events-none z-10',
            'rounded-[calc(var(--radius)-2px)]',
            status === 'loading' && 'node-status-loading',
            status === 'success' && 'ring-2 ring-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]',
            status === 'error' && 'ring-2 ring-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]',
          )}
        />
      )}
      {children}
    </div>
  );
}
