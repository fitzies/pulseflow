import { Children, cloneElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type NodeStatus = 'initial' | 'loading' | 'success' | 'error';

interface NodeStatusIndicatorProps extends ComponentProps<'div'> {
  status: NodeStatus;
  children: ReactNode;
}

const StatusOverlay = ({ status }: { status: Exclude<NodeStatus, 'initial'> }) => (
  <div
    className={cn(
      'absolute inset-0 pointer-events-none z-10',
      'rounded-[calc(var(--radius)-2px)]',
      status === 'loading' && 'node-status-loading',
      status === 'success' && 'ring-2 ring-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]',
      status === 'error' && 'ring-2 ring-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]',
    )}
  />
);

export function NodeStatusIndicator({
  status,
  children,
  className,
  ...props
}: NodeStatusIndicatorProps) {
  try {
    const child = Children.only(children);
    if (!isValidElement(child) || typeof child.props.children === 'undefined') {
      throw new Error('Unexpected structure');
    }
    const wrapperChildren = Children.toArray(child.props.children);
    const [baseNode, ...rest] = wrapperChildren;

    if (baseNode === undefined) {
      throw new Error('No base node');
    }

    return cloneElement(child as ReactElement<{ children?: ReactNode }>, {}, (
      <>
        <div className="relative">
          {status !== 'initial' && <StatusOverlay status={status} />}
          {baseNode}
        </div>
        {rest}
      </>
    ));
  } catch {
    return (
      <div className={cn('relative', className)} {...props}>
        {status !== 'initial' && <StatusOverlay status={status} />}
        {children}
      </div>
    );
  }
}
