'use client';

import { memo } from 'react';
import { PlayIcon, PlusIcon, ClockIcon, CurrencyDollarIcon } from '@heroicons/react/24/solid';
import { Handle, Position } from '@xyflow/react';
import { BaseNode, BaseNodeHeaderTitle } from '@/components/base-node';
import { Button } from '@/components/ui/button';
import type { NodeProps } from '@xyflow/react';
import { getNodeBackgroundColor, getNodeTextColor } from './node-colors';

interface StartNodeData {
  onAddNode?: () => void;
  onNodeClick?: () => void;
  isLastNode?: boolean;
  showNodeLabels?: boolean;
  triggerMode?: 'MANUAL' | 'SCHEDULE' | 'PRICE_TRIGGER';
  cronExpression?: string | null;
  nextRunAt?: Date | null;
}

export const StartNode = memo(({ data }: NodeProps) => {
  const nodeData = data as StartNodeData;
  const handleAddClick = () => {
    nodeData?.onAddNode?.();
  };
  const handleNodeClick = () => {
    nodeData?.onNodeClick?.();
  };

  const isScheduled = nodeData?.triggerMode === 'SCHEDULE';
  const isPriceTrigger = nodeData?.triggerMode === 'PRICE_TRIGGER';
  const Icon = isPriceTrigger ? CurrencyDollarIcon : isScheduled ? ClockIcon : PlayIcon;

  return (
    <BaseNode className="w-32 cursor-pointer" onClick={handleNodeClick}>
      <div className="flex flex-col items-center justify-center p-4 gap-2">
        <div className={`rounded-xl ${getNodeBackgroundColor('start')} p-3 flex items-center justify-center relative`}>
          <Icon className={`h-8 w-8 ${getNodeTextColor('start')}`} />
        </div>
        {nodeData?.showNodeLabels !== false && (
          <BaseNodeHeaderTitle className="font-normal text-sm text-center">
            {isPriceTrigger ? 'Price' : isScheduled ? 'Scheduled' : 'Start'}
          </BaseNodeHeaderTitle>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} id="start-output" className="opacity-0" />
      {nodeData?.isLastNode && (
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 z-10">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleAddClick();
            }}
            size="sm"
            variant="secondary"
            className="rounded-full"
          >
            <PlusIcon className="h-2.5 w-2.5" />
          </Button>
        </div>
      )}
    </BaseNode>
  );
});

StartNode.displayName = 'StartNode';
