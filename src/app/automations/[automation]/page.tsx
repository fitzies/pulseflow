'use client';

import { useState, useCallback, memo } from 'react';
import { 
  ReactFlow, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge,
  Background,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BaseNode, BaseNodeContent } from '@/components/base-node';

const SimpleNode = memo(({ data }: NodeProps) => {
  return (
    <BaseNode className="w-48">
      <BaseNodeContent>
        <p className="text-sm">{data?.label as string || 'Node'}</p>
      </BaseNodeContent>
    </BaseNode>
  );
});

SimpleNode.displayName = 'SimpleNode';

const nodeTypes = {
  simple: SimpleNode,
};

const initialNodes: Node[] = [
  { 
    id: 'n1', 
    position: { x: 0, y: 0 }, 
    data: { label: 'Node 1' },
    type: 'simple',
  },
  { 
    id: 'n2', 
    position: { x: 0, y: 150 }, 
    data: { label: 'Node 2' },
    type: 'simple',
  },
];
const initialEdges: Edge[] = [{ id: 'n1-n2', source: 'n1', target: 'n2' }];

export default function Page() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );
  const onConnect: OnConnect = useCallback(
    (params) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );

  return (
    <div className="w-full h-screen dark">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
      </ReactFlow>
    </div>
  );
}
