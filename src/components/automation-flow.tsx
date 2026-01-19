'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
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
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { JsonRpcProvider, formatEther } from 'ethers';
import {
  StartNode,
  SwapNode,
  SwapPLSNode,
  TransferNode,
  AddLiquidityNode,
  AddLiquidityPLSNode,
  RemoveLiquidityNode,
  RemoveLiquidityPLSNode,
  CheckBalanceNode,
  CheckLPTokenAmountsNode,
  BurnTokenNode,
  ClaimTokenNode,
  WaitNode,
} from '@/components/nodes';
import { SelectNodeDialog, type NodeType } from '@/components/select-node-dialog';
import { NodeConfigSheet } from '@/components/node-config-sheet';
import { updateAutomationDefinition } from '@/lib/actions/automations';
import { Button } from '@/components/ui/button';

const nodeTypes: NodeTypes = {
  start: StartNode,
  swap: SwapNode,
  swapPLS: SwapPLSNode,
  transfer: TransferNode,
  addLiquidity: AddLiquidityNode,
  addLiquidityPLS: AddLiquidityPLSNode,
  removeLiquidity: RemoveLiquidityNode,
  removeLiquidityPLS: RemoveLiquidityPLSNode,
  checkBalance: CheckBalanceNode,
  checkLPTokenAmounts: CheckLPTokenAmountsNode,
  burnToken: BurnTokenNode,
  claimToken: ClaimTokenNode,
  wait: WaitNode,
};

const defaultStartNode: Node[] = [
  {
    id: 'start-1',
    position: { x: 0, y: 0 },
    data: {},
    type: 'start',
  },
];

interface AutomationFlowProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  automationId: string;
  walletAddress: string;
}

const PULSECHAIN_RPC = 'https://rpc.pulsechain.com';

export function AutomationFlow({
  initialNodes,
  initialEdges,
  automationId,
  walletAddress,
}: AutomationFlowProps) {
  const nodesToUse = useMemo(() => {
    if (initialNodes && initialNodes.length > 0) {
      return initialNodes;
    }
    return defaultStartNode;
  }, [initialNodes]);

  const [nodes, setNodes] = useState<Node[]>(nodesToUse);
  const [edges, setEdges] = useState<Edge[]>(initialEdges || []);
  const [plsBalance, setPlsBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sourceNodeId, setSourceNodeId] = useState<string | null>(null);
  const [configSheetOpen, setConfigSheetOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Fetch PLS balance
  useEffect(() => {
    async function fetchBalance() {
      try {
        const provider = new JsonRpcProvider(PULSECHAIN_RPC);
        const balance = await provider.getBalance(walletAddress);
        const formattedBalance = formatEther(balance);
        setPlsBalance(parseFloat(formattedBalance).toFixed(4));
      } catch (error) {
        console.error('Error fetching balance:', error);
        setPlsBalance('0');
      } finally {
        setIsLoadingBalance(false);
      }
    }

    fetchBalance();
  }, [walletAddress]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Save to database whenever nodes or edges change
  useEffect(() => {
    async function saveAutomation() {
      // Strip non-serializable data (functions) from nodes before saving
      const serializableNodes = nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          config: node.data?.config || {},
        },
      }));

      // Ensure edges have all required properties
      const serializableEdges = edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || null,
        targetHandle: edge.targetHandle || null,
      }));

      const result = await updateAutomationDefinition(automationId, serializableNodes, serializableEdges);
      if (!result.success) {
        console.error('Failed to save automation:', result.error);
      }
    }
    saveAutomation();
  }, [nodes, edges, automationId]);

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

  const handleOpenDialog = useCallback((nodeId: string) => {
    setSourceNodeId(nodeId);
    setDialogOpen(true);
  }, []);

  const handleAddNode = useCallback(
    (nodeType: NodeType) => {
      if (!sourceNodeId) return;

      const sourceNode = nodes.find((n) => n.id === sourceNodeId);
      if (!sourceNode) return;

      const newNodeId = `${nodeType}-${Date.now()}`;
      const newNode: Node = {
        id: newNodeId,
        position: {
          x: sourceNode.position.x + 250,
          y: sourceNode.position.y,
        },
        data: {},
        type: nodeType,
      };

      const sourceHandleId = sourceNode.type === 'start' ? 'start-output' : 'output';
      
      const newEdge: Edge = {
        id: `edge-${sourceNodeId}-${newNodeId}`,
        source: sourceNodeId,
        target: newNodeId,
        sourceHandle: sourceHandleId,
      };

      setNodes((prevNodes) => [...prevNodes, newNode]);
      setEdges((prevEdges) => [...prevEdges, newEdge]);
      setSourceNodeId(null);
    },
    [nodes, sourceNodeId],
  );

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setConfigSheetOpen(true);
  }, []);

  const handleSaveConfig = useCallback((nodeId: string, config: Record<string, any>) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, config } }
          : node
      )
    );
  }, []);

  const lastNodeId = useMemo(() => {
    // Find the node that has no outgoing edges (the last node in the chain)
    const nodesWithOutgoingEdges = new Set(edges.map((edge) => edge.source));
    const lastNode = nodes.find((node) => !nodesWithOutgoingEdges.has(node.id));
    return lastNode?.id || null;
  }, [nodes, edges]);

  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => {
      const isLastNode = node.id === lastNodeId;
      return {
        ...node,
        data: {
          ...node.data,
          onAddNode: isLastNode ? () => handleOpenDialog(node.id) : undefined,
          onNodeClick: () => handleNodeClick(node.id),
          isLastNode,
        },
      };
    });
  }, [nodes, handleOpenDialog, lastNodeId, handleNodeClick]);

  return (
    <div className="w-full h-screen dark relative">
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
      </ReactFlow>
      <SelectNodeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSelectNode={handleAddNode}
      />
      {selectedNodeId && (
        <NodeConfigSheet
          nodeId={selectedNodeId}
          nodeType={nodes.find((n) => n.id === selectedNodeId)?.type as NodeType | null}
          open={configSheetOpen}
          onOpenChange={setConfigSheetOpen}
          config={nodes.find((n) => n.id === selectedNodeId)?.data?.config}
          onSave={handleSaveConfig}
          nodes={nodes}
          edges={edges}
        />
      )}
      <div className="absolute top-4 left-4 z-10 rounded-lg bg-card border p-3 shadow-lg min-w-[280px]">
        <div className="text-xs text-muted-foreground mb-1">Automation ID</div>
        <div className="text-sm font-mono">{automationId}</div>
        
        <div className="text-xs text-muted-foreground mt-3 mb-1">Wallet Address</div>
        <button
          onClick={copyToClipboard}
          className="text-sm font-mono hover:text-foreground transition-colors cursor-pointer text-left w-full"
          title="Click to copy"
        >
          {copied ? (
            <span className="text-green-500">Copied!</span>
          ) : (
            <span className="truncate block">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          )}
        </button>

        <div className="text-xs text-muted-foreground mt-3 mb-1">Balance</div>
        <div className="text-sm font-mono">
          {isLoadingBalance ? (
            'Loading...'
          ) : (
            <>
              {plsBalance} PLS <span className="text-xs text-muted-foreground">($0.00 USD)</span>
            </>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            variant="default"
            size="sm"
            disabled={isRunning}
            className="flex-1"
          >
            Start
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!isRunning}
            className="flex-1"
          >
            Stop
          </Button>
        </div>
      </div>
    </div>
  );
}
