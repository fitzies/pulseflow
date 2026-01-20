'use client';

import { useState, useCallback, useMemo, useEffect, useRef, ComponentType } from 'react';
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
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { JsonRpcProvider, formatEther } from 'ethers';
import {
  StartNode,
  SwapNode,
  SwapFromPLSNode,
  SwapToPLSNode,
  TransferNode,
  AddLiquidityNode,
  AddLiquidityPLSNode,
  RemoveLiquidityNode,
  RemoveLiquidityPLSNode,
  CheckBalanceNode,
  CheckTokenBalanceNode,
  CheckLPTokenAmountsNode,
  BurnTokenNode,
  ClaimTokenNode,
  WaitNode,
  GetTokenPriceNode,
  LoopNode,
  GasGuardNode,
  FailureHandleNode,
  WindowedExecutionNode,
} from '@/components/nodes';
import { SelectNodeDialog, type NodeType } from '@/components/select-node-dialog';
import { NodeConfigSheet } from '@/components/node-config-sheet';
import { updateAutomationDefinition } from '@/lib/actions/automations';
import { Button } from '@/components/ui/button';
import { ArrowPathIcon, PlayIcon, StopIcon, Cog6ToothIcon } from '@heroicons/react/24/solid';
import { toast } from 'sonner';
import { NodeStatusIndicator, type NodeStatus } from '@/components/node-status-indicator';
import { AutomationSettingsDialog } from '@/components/automation-settings-dialog';

// Higher-order component to wrap nodes with status indicator
function withStatusIndicator<P extends NodeProps>(WrappedComponent: ComponentType<P>) {
  const WithStatusIndicator = (props: P) => {
    const status = (props.data as { status?: NodeStatus })?.status || 'initial';
    return (
      <NodeStatusIndicator status={status}>
        <WrappedComponent {...props} />
      </NodeStatusIndicator>
    );
  };
  WithStatusIndicator.displayName = `WithStatusIndicator(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return WithStatusIndicator;
}

const nodeTypes: NodeTypes = {
  start: withStatusIndicator(StartNode),
  swap: withStatusIndicator(SwapNode),
  swapFromPLS: withStatusIndicator(SwapFromPLSNode),
  swapToPLS: withStatusIndicator(SwapToPLSNode),
  transfer: withStatusIndicator(TransferNode),
  addLiquidity: withStatusIndicator(AddLiquidityNode),
  addLiquidityPLS: withStatusIndicator(AddLiquidityPLSNode),
  removeLiquidity: withStatusIndicator(RemoveLiquidityNode),
  removeLiquidityPLS: withStatusIndicator(RemoveLiquidityPLSNode),
  checkBalance: withStatusIndicator(CheckBalanceNode),
  checkTokenBalance: withStatusIndicator(CheckTokenBalanceNode),
  checkLPTokenAmounts: withStatusIndicator(CheckLPTokenAmountsNode),
  burnToken: withStatusIndicator(BurnTokenNode),
  claimToken: withStatusIndicator(ClaimTokenNode),
  wait: withStatusIndicator(WaitNode),
  getTokenPrice: withStatusIndicator(GetTokenPriceNode),
  loop: withStatusIndicator(LoopNode),
  gasGuard: withStatusIndicator(GasGuardNode),
  failureHandle: withStatusIndicator(FailureHandleNode),
  windowedExecution: withStatusIndicator(WindowedExecutionNode),
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
  automationName: string;
  userPlan: 'BASIC' | 'PRO' | 'ULTRA' | null;
  defaultSlippage: number;
  rpcEndpoint: string | null;
  showNodeLabels: boolean;
  activeExecution?: { id: string; status: string } | null;
}

const PULSECHAIN_RPC = 'https://rpc.pulsechain.com';

export function AutomationFlow({
  initialNodes,
  initialEdges,
  automationId,
  walletAddress,
  automationName,
  userPlan,
  defaultSlippage,
  rpcEndpoint,
  showNodeLabels: initialShowNodeLabels,
  activeExecution,
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
  const [isRunning, setIsRunning] = useState(!!activeExecution);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(activeExecution?.id ?? null);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>({});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [showNodeLabels, setShowNodeLabels] = useState(initialShowNodeLabels);
  const [currentRpcEndpoint, setCurrentRpcEndpoint] = useState(rpcEndpoint || PULSECHAIN_RPC);
  const [currentName, setCurrentName] = useState(automationName);
  const [currentDefaultSlippage, setCurrentDefaultSlippage] = useState(defaultSlippage);

  // Fetch PLS balance
  useEffect(() => {
    async function fetchBalance() {
      try {
        const provider = new JsonRpcProvider(currentRpcEndpoint);
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
  }, [walletAddress, currentRpcEndpoint]);

  // Poll for execution status when reconnecting to a running automation
  useEffect(() => {
    if (!activeExecutionId || !isRunning) return;

    // Helper to update node statuses from logs
    const updateNodeStatusesFromLogs = (logs: Array<{ nodeId: string; error: string | null }>) => {
      const newStatuses: Record<string, NodeStatus> = {};
      for (const log of logs) {
        newStatuses[log.nodeId] = log.error ? 'error' : 'success';
      }
      setNodeStatuses((prev) => ({ ...prev, ...newStatuses }));
    };

    // Fetch initial status immediately
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/executions/${activeExecutionId}`);
        if (!response.ok) return false;

        const data = await response.json();
        
        // Update node statuses from logs
        if (data.logs?.length > 0) {
          updateNodeStatusesFromLogs(data.logs);
        }

        if (data.status !== 'RUNNING') {
          setIsRunning(false);
          setActiveExecutionId(null);

          if (data.status === 'SUCCESS') {
            toast.success('Automation completed successfully!');
            const provider = new JsonRpcProvider(currentRpcEndpoint);
            const balance = await provider.getBalance(walletAddress);
            const formattedBalance = formatEther(balance);
            setPlsBalance(parseFloat(formattedBalance).toFixed(4));
          } else if (data.status === 'FAILED') {
            toast.error(data.error || 'Automation failed');
          }
          return false; // Stop polling
        }
        return true; // Continue polling
      } catch (error) {
        console.error('Error polling execution status:', error);
        return true;
      }
    };

    // Fetch immediately on mount
    fetchStatus();

    // Then poll every 3 seconds
    const pollInterval = setInterval(async () => {
      const shouldContinue = await fetchStatus();
      if (!shouldContinue) {
        clearInterval(pollInterval);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [activeExecutionId, isRunning, currentRpcEndpoint, walletAddress]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Save to database whenever nodes or edges change (debounced)
  useEffect(() => {
    // Clear any pending save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set a new timeout to save after 500ms of inactivity
    saveTimeoutRef.current = setTimeout(async () => {
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
    }, 500);

    // Cleanup: clear timeout on unmount or when dependencies change
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
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

  const handleDeleteNode = useCallback((nodeId: string) => {
    // Remove the node
    setNodes((prevNodes) => prevNodes.filter((node) => node.id !== nodeId));
    
    // Remove all edges connected to this node
    setEdges((prevEdges) =>
      prevEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    );
    
    // Close the config sheet if it's open for this node
    if (selectedNodeId === nodeId) {
      setConfigSheetOpen(false);
      setSelectedNodeId(null);
    }
  }, [selectedNodeId]);

  const handleStart = useCallback(async () => {
    setIsRunning(true);
    // Reset all node statuses
    setNodeStatuses({});

    try {
      const response = await fetch(`/api/automations/${automationId}/run`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to start automation');
        setIsRunning(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        toast.error('Failed to read response stream');
        setIsRunning(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'node_start') {
              setNodeStatuses((prev) => ({
                ...prev,
                [data.nodeId]: 'loading',
              }));
            } else if (data.type === 'node_complete') {
              setNodeStatuses((prev) => ({
                ...prev,
                [data.nodeId]: 'success',
              }));
            } else if (data.type === 'node_error') {
              setNodeStatuses((prev) => ({
                ...prev,
                [data.nodeId]: 'error',
              }));
            } else if (data.type === 'done') {
              setActiveExecutionId(null);
              if (data.success) {
                toast.success('Automation executed successfully!');
                // Refresh balance after execution
                const provider = new JsonRpcProvider(currentRpcEndpoint);
                const balance = await provider.getBalance(walletAddress);
                const formattedBalance = formatEther(balance);
                setPlsBalance(parseFloat(formattedBalance).toFixed(4));
              } else {
                toast.error(data.error || 'Automation failed');
              }
            }
          }
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to run automation');
    } finally {
      setIsRunning(false);
    }
  }, [automationId, walletAddress, currentRpcEndpoint]);

  const lastNodeId = useMemo(() => {
    // Find the node that has no outgoing edges (the last node in the chain)
    const nodesWithOutgoingEdges = new Set(edges.map((edge) => edge.source));
    const lastNode = nodes.find((node) => !nodesWithOutgoingEdges.has(node.id));
    return lastNode?.id || null;
  }, [nodes, edges]);

  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => {
      const isLastNode = node.id === lastNodeId;
      const status = nodeStatuses[node.id] || 'initial';
      return {
        ...node,
        data: {
          ...node.data,
          onAddNode: isLastNode ? () => handleOpenDialog(node.id) : undefined,
          onNodeClick: () => handleNodeClick(node.id),
          isLastNode,
          status,
          showNodeLabels,
        },
      };
    });
  }, [nodes, handleOpenDialog, lastNodeId, handleNodeClick, nodeStatuses, showNodeLabels]);

  const handleSettingsUpdate = useCallback(() => {
    // Refresh the page to get updated settings
    window.location.reload();
  }, []);

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
          config={(nodes.find((n) => n.id === selectedNodeId)?.data as Record<string, any> | undefined)?.config}
          onSave={handleSaveConfig}
          onDelete={handleDeleteNode}
          nodes={nodes}
          edges={edges}
        />
      )}
      <div className="absolute top-4 left-4 z-10 rounded-lg bg-card border p-3 shadow-lg min-w-[280px]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-muted-foreground">Automation</div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsDialogOpen(true)}
            className="h-6 w-6"
          >
            <Cog6ToothIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm font-semibold mb-3">{currentName}</div>
        
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
          {isLoadingBalance ? 'Loading...' : `${plsBalance} PLS`}
        </div>
      </div>
      
      <AutomationSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        automationId={automationId}
        initialName={currentName}
        initialDefaultSlippage={currentDefaultSlippage}
        initialRpcEndpoint={rpcEndpoint}
        initialShowNodeLabels={showNodeLabels}
        userPlan={userPlan}
        onSettingsUpdate={handleSettingsUpdate}
      />
      
      {/* Player Controls - Bottom Center */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
        <div className="rounded-full bg-card border shadow-lg px-4 py-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            disabled={isRunning}
            onClick={handleStart}
            className="rounded-full h-10 w-10"
          >
            {isRunning ? (
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
            ) : (
              <PlayIcon className="h-5 w-5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={!isRunning}
            className="rounded-full h-10 w-10 text-destructive hover:text-destructive"
          >
            <StopIcon className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
