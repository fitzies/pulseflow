'use client';

import { memo } from 'react';
import { QuestionMarkCircleIcon, PlusIcon } from '@heroicons/react/24/solid';
import { Handle, Position } from '@xyflow/react';
import { BaseNode } from '@/components/base-node';
import { LabeledHandle } from '@/components/labeled-handle';
import { Button } from '@/components/ui/button';
import type { NodeProps } from '@xyflow/react';
import { getNodeBackgroundColor, getNodeTextColor, NODE_WRAPPER_CLASS, NODE_WIDTH_CONDITION_CLASS, NODE_HEIGHT_CONDITION_CLASS, NODE_LABEL_CONTAINER_CLASS, NODE_TITLE_CLASS, NODE_NOTES_CLASS } from './node-colors';

interface ConditionNodeData {
  onAddNode?: (sourceHandle: string) => void;
  onNodeClick?: () => void;
  hasTrueBranch?: boolean;
  hasFalseBranch?: boolean;
  showNodeLabels?: boolean;
  config?: {
    conditionType?: 'plsBalance' | 'tokenBalance' | 'lpAmount' | 'previousOutput';
    operator?: '>' | '<' | '>=' | '<=' | '==';
    value?: string;
    tokenAddress?: string;
    lpPairAddress?: string;
    previousOutputField?: string;
    notes?: string;
  };
}

export const ConditionNode = memo(({ data }: NodeProps) => {
  const nodeData = data as ConditionNodeData;

  const handleAddTrueClick = () => {
    nodeData?.onAddNode?.('output-true');
  };

  const handleAddFalseClick = () => {
    nodeData?.onAddNode?.('output-false');
  };

  const handleNodeClick = () => {
    nodeData?.onNodeClick?.();
  };

  // Get a summary of the condition for display
  const getConditionSummary = () => {
    const config = nodeData?.config;
    if (!config?.conditionType || !config?.operator || !config?.value) {
      return null;
    }

    const typeLabels: Record<string, string> = {
      plsBalance: 'PLS',
      tokenBalance: 'Token',
      lpAmount: 'LP',
      previousOutput: 'Prev',
    };

    return `${typeLabels[config.conditionType]} ${config.operator} ${config.value}`;
  };

  const conditionSummary = getConditionSummary();
  const hasNotes = !!nodeData?.config?.notes;
  const showLabels = nodeData?.showNodeLabels !== false;

  return (
    <div className={NODE_WRAPPER_CLASS}>
      <BaseNode className={`${NODE_WIDTH_CONDITION_CLASS} ${NODE_HEIGHT_CONDITION_CLASS} cursor-pointer`} onClick={handleNodeClick}>
        <Handle type="target" position={Position.Top} className="opacity-0" />
        <div className="flex items-center justify-center p-3">
          <div className={`rounded-xl ${getNodeBackgroundColor('condition')} p-3 flex items-center justify-center`}>
            <QuestionMarkCircleIcon className={`h-8 w-8 ${getNodeTextColor('condition')}`} />
          </div>
        </div>

        {/* Labeled output handles */}
        <div className="flex justify-between pb-3 px-2">
          <LabeledHandle
            id="output-false"
            title="False"
            type="source"
            position={Position.Bottom}
            labelClassName="text-xs text-red-400"
            handleClassName="!relative !transform-none !left-0 !top-0"
          />
          <LabeledHandle
            id="output-true"
            title="True"
            type="source"
            position={Position.Bottom}
            labelClassName="text-xs text-green-400"
            handleClassName="!relative !transform-none !left-0 !top-0"
          />
        </div>

        {/* Two + buttons for adding to each branch */}
        {!nodeData?.hasFalseBranch && (
          <div className="absolute bottom-0 left-[25%] transform -translate-x-1/2 translate-y-1/2 z-10">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleAddFalseClick();
              }}
              size="sm"
              variant="secondary"
              className="rounded-full h-6 w-6 p-0"
            >
              <PlusIcon className="h-2.5 w-2.5" />
            </Button>
          </div>
        )}

        {!nodeData?.hasTrueBranch && (
          <div className="absolute bottom-0 left-[75%] transform -translate-x-1/2 translate-y-1/2 z-10">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleAddTrueClick();
              }}
              size="sm"
              variant="secondary"
              className="rounded-full h-6 w-6 p-0"
            >
              <PlusIcon className="h-2.5 w-2.5" />
            </Button>
          </div>
        )}
      </BaseNode>
      {showLabels && (
        <div className={NODE_LABEL_CONTAINER_CLASS}>
          <span className={NODE_TITLE_CLASS}>{conditionSummary || 'Condition'}</span>
          {hasNotes && (
            <p className={NODE_NOTES_CLASS}>
              {nodeData?.config?.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

ConditionNode.displayName = 'ConditionNode';
