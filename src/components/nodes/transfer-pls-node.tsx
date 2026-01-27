'use client';

import { memo } from 'react';
import { PaperAirplaneIcon, PlusIcon } from '@heroicons/react/24/solid';
import { Handle, Position } from '@xyflow/react';
import { BaseNode } from '@/components/base-node';
import { Button } from '@/components/ui/button';
import type { NodeProps } from '@xyflow/react';
import { getNodeBackgroundColor, getNodeTextColor, NODE_WRAPPER_CLASS, NODE_WIDTH_CLASS, NODE_HEIGHT_CLASS, NODE_LABEL_CONTAINER_CLASS, NODE_TITLE_CLASS, NODE_NOTES_CLASS } from './node-colors';

interface TransferPLSNodeData {
  onAddNode?: () => void;
  onNodeClick?: () => void;
  isLastNode?: boolean;
  showNodeLabels?: boolean;
  config?: {
    notes?: string;
  };
}

export const TransferPLSNode = memo(({ data }: NodeProps) => {
  const nodeData = data as TransferPLSNodeData;
  const handleAddClick = () => {
    nodeData?.onAddNode?.();
  };
  const handleNodeClick = () => {
    nodeData?.onNodeClick?.();
  };

  return (
    <div className={NODE_WRAPPER_CLASS}>
      <BaseNode className={`${NODE_WIDTH_CLASS} ${NODE_HEIGHT_CLASS} cursor-pointer`} onClick={handleNodeClick}>
        <Handle type="target" position={Position.Top} className="opacity-0" />
        <div className="flex items-center justify-center p-3">
          <div className={`rounded-xl ${getNodeBackgroundColor('transferPLS')} p-3 flex items-center justify-center`}>
            <PaperAirplaneIcon className={`h-8 w-8 ${getNodeTextColor('transferPLS')}`} />
          </div>
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
      {nodeData?.showNodeLabels !== false && (
        <div className={NODE_LABEL_CONTAINER_CLASS}>
          <span className={NODE_TITLE_CLASS}>Transfer PLS</span>
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

TransferPLSNode.displayName = 'TransferPLSNode';
