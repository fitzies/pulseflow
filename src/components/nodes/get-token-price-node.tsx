'use client';

import { memo } from 'react';
import { ArrowTrendingUpIcon, PlusIcon } from '@heroicons/react/24/solid';
import { Handle, Position } from '@xyflow/react';
import { BaseNode, BaseNodeHeaderTitle } from '@/components/base-node';
import { Button } from '@/components/ui/button';
import type { NodeProps } from '@xyflow/react';
import { getNodeBackgroundColor, getNodeTextColor } from './node-colors';

interface GetTokenPriceNodeData {
  onAddNode?: () => void;
  onNodeClick?: () => void;
  isLastNode?: boolean;
  showNodeLabels?: boolean;
}

export const GetTokenPriceNode = memo(({ data }: NodeProps) => {
  const nodeData = data as GetTokenPriceNodeData;
  const handleAddClick = () => {
    nodeData?.onAddNode?.();
  };
  const handleNodeClick = () => {
    nodeData?.onNodeClick?.();
  };

  return (
    <BaseNode className="w-36 cursor-pointer" onClick={handleNodeClick}>
      <Handle type="target" position={Position.Top} />
      <div className="flex flex-col items-center justify-center p-4 gap-2">
        <div className={`rounded-xl ${getNodeBackgroundColor('getTokenPrice')} p-3 flex items-center justify-center`}>
          <ArrowTrendingUpIcon className={`h-8 w-8 ${getNodeTextColor('getTokenPrice')}`} />
        </div>
        {nodeData?.showNodeLabels !== false && (
          <BaseNodeHeaderTitle className="font-normal text-sm text-center">Get Token Price</BaseNodeHeaderTitle>
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

GetTokenPriceNode.displayName = 'GetTokenPriceNode';
