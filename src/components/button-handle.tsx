'use client';

import { ConnectionState, Position, useConnection, Handle, type HandleProps } from '@xyflow/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ButtonHandleProps extends HandleProps {
  children: ReactNode;
  showButton?: boolean;
}

export function ButtonHandle({
  children,
  showButton = true,
  position,
  ...handleProps
}: ButtonHandleProps) {
  const selector = (connection: ConnectionState) => connection.inProgress;
  const connectionInProgress = useConnection(selector);

  const positionClasses = {
    [Position.Top]: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
    [Position.Bottom]: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
    [Position.Left]: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2',
    [Position.Right]: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2',
  };

  return (
    <>
      <Handle position={position} {...handleProps} />
      {showButton && !connectionInProgress && (
        <div
          className={cn(
            'absolute pointer-events-auto z-10',
            position ? positionClasses[position] : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
          )}
        >
          {children}
        </div>
      )}
    </>
  );
}
