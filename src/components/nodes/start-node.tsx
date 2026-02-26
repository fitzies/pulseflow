'use client';

import { memo } from 'react';
import { PlayIcon, PlusIcon, ClockIcon, CurrencyDollarIcon } from '@heroicons/react/24/solid';
import { Handle, Position } from '@xyflow/react';
import { NodeCardWithStatus } from '@/components/node-card-with-status';
import type { NodeStatus } from '@/components/node-status-indicator';
import { Button } from '@/components/ui/button';
import type { NodeProps } from '@xyflow/react';
import { getNodeBackgroundColor, getNodeTextColor, NODE_WRAPPER_CLASS, NODE_WIDTH_CLASS, NODE_HEIGHT_CLASS, NODE_LABEL_CONTAINER_CLASS, NODE_TITLE_CLASS, NODE_NOTES_CLASS } from './node-colors';

interface StartNodeData {
  onAddNode?: () => void;
  onNodeClick?: () => void;
  isLastNode?: boolean;
  showNodeLabels?: boolean;
  triggerMode?: 'MANUAL' | 'SCHEDULE' | 'PRICE_TRIGGER';
  cronExpression?: string | null;
  nextRunAt?: Date | null;
  config?: {
    notes?: string;
  };
}

export const StartNode = memo(({ data }: NodeProps) => {
  const nodeData = data as StartNodeData;
  const status = (nodeData as { status?: NodeStatus })?.status ?? 'initial';
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
    <div className={NODE_WRAPPER_CLASS}>
      <NodeCardWithStatus status={status} className={`${NODE_WIDTH_CLASS} ${NODE_HEIGHT_CLASS} cursor-pointer`} onClick={handleNodeClick}>
        <div className="flex items-center justify-center p-3">
          <div className={`rounded-xl ${getNodeBackgroundColor('start')} p-3 flex items-center justify-center relative`}>
            <Icon className={`h-8 w-8 ${getNodeTextColor('start')}`} />
          </div>
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
      </NodeCardWithStatus>
      {nodeData?.showNodeLabels !== false && (
        <div className={NODE_LABEL_CONTAINER_CLASS}>
          <span className={NODE_TITLE_CLASS}>
            {isPriceTrigger ? 'Price Trigger' : isScheduled ? 'Scheduled' : 'Start'}
          </span>
          {nodeData?.config?.notes && (
            <p className={NODE_NOTES_CLASS}>
              {nodeData.config.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

StartNode.displayName = 'StartNode';
