'use client';

import { memo } from 'react';
import { PaperAirplaneIcon, PlusIcon } from '@heroicons/react/24/solid';
import { Handle, Position } from '@xyflow/react';
import { BaseNode, BaseNodeHeaderTitle } from '@/components/base-node';
import { Button } from '@/components/ui/button';
import type { NodeProps } from '@xyflow/react';
import { getNodeBackgroundColor, getNodeTextColor } from './node-colors';

interface TransferNodeData {
  onAddNode?: () => void;
  onNodeClick?: () => void;
  isLastNode?: boolean;
  showNodeLabels?: boolean;
  config?: {
    notes?: string;
  };
}

export const TransferNode = memo(({ data }: NodeProps) => {
  const nodeData = data as TransferNodeData;
  const handleAddClick = () => {
    nodeData?.onAddNode?.();
  };
  const handleNodeClick = () => {
    nodeData?.onNodeClick?.();
  };

  const hasNotes = !!nodeData?.config?.notes;
  const showLabels = nodeData?.showNodeLabels !== false;

  return (
    <BaseNode className="w-36 h-36 cursor-pointer" onClick={handleNodeClick}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div className={`flex flex-col items-center justify-center h-full p-4 ${hasNotes ? 'gap-2' : showLabels ? 'gap-1' : ''}`}>
        <div className={`rounded-xl ${getNodeBackgroundColor('transfer')} p-3 flex items-center justify-center`}>
          <PaperAirplaneIcon className={`h-8 w-8 ${getNodeTextColor('transfer')}`} />
        </div>
        {showLabels && (
          <>
            <BaseNodeHeaderTitle className="font-normal text-sm text-center">Transfer</BaseNodeHeaderTitle>
            {hasNotes && (
              <p className="text-xs text-muted-foreground text-center px-1 break-words">
                {nodeData?.config?.notes}

              </p>
            )}
          </>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} id="output" className="opacity-0" />
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

TransferNode.displayName = 'TransferNode';
