'use client';

import { memo } from 'react';
import { Play, Plus } from 'lucide-react';
import { Handle, Position } from '@xyflow/react';
import { BaseNode, BaseNodeHeaderTitle } from '@/components/base-node';
import { Button } from '@/components/ui/button';
import type { NodeProps } from '@xyflow/react';

interface StartNodeData {
  onAddNode?: () => void;
  onNodeClick?: () => void;
  isLastNode?: boolean;
}

export const StartNode = memo(({ data }: NodeProps) => {
  const nodeData = data as StartNodeData;
  const handleAddClick = () => {
    nodeData?.onAddNode?.();
  };
  const handleNodeClick = () => {
    nodeData?.onNodeClick?.();
  };

  return (
    <BaseNode className="w-32 cursor-pointer" onClick={handleNodeClick}>
      <div className="flex flex-col items-center justify-center p-4 gap-2">
        <div className="rounded-xl bg-green-400/20 p-3 flex items-center justify-center">
          <Play className="h-8 w-8 text-green-400" />
        </div>
        <BaseNodeHeaderTitle className="font-normal text-sm text-center">Start</BaseNodeHeaderTitle>
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
            <Plus size={10} />
          </Button>
        </div>
      )}
    </BaseNode>
  );
});

StartNode.displayName = 'StartNode';
