'use client';

import { memo } from 'react';
import { type EdgeProps } from '@xyflow/react';
import { ButtonEdge } from '@/components/button-edge';
import { Button } from '@/components/ui/button';
import { PlusIcon } from '@heroicons/react/24/solid';

export const AddNodeButtonEdge = memo((props: EdgeProps) => {
  const { id, source, target, data } = props;
  
  const handleClick = () => {
    const onEdgeClick = data?.onEdgeClick as ((sourceId: string, targetId: string) => void) | undefined;
    if (onEdgeClick && source && target) {
      onEdgeClick(source, target);
    }
  };

  return (
    <ButtonEdge {...props}>
      <Button
        onClick={handleClick}
        size="icon"
        variant="secondary"
        className="h-6 w-6 rounded-full shadow-sm hover:shadow-md transition-shadow"
      >
        <PlusIcon className="h-3 w-3" />
      </Button>
    </ButtonEdge>
  );
});

AddNodeButtonEdge.displayName = 'AddNodeButtonEdge';
