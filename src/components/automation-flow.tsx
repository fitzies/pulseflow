'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  Background,
  type OnNodesChange,
  type OnEdgesChange,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { JsonRpcProvider, formatEther } from 'ethers';
import {
  StartNode,
  SwapNode,
  SwapFromPLSNode,
  SwapToPLSNode,
  TransferNode,
  TransferPLSNode,
  AddLiquidityNode,
  AddLiquidityPLSNode,
  RemoveLiquidityNode,
  RemoveLiquidityPLSNode,
  CheckBalanceNode,
  CheckTokenBalanceNode,
  CheckLPTokenAmountsNode,
  BurnTokenNode,
  ClaimTokenNode,
  GetParentNode,
  WaitNode,
  LoopNode,
  GasGuardNode,
  ConditionNode,
  TelegramNode,
  VariableNode,
  CalculatorNode,
  DexQuoteNode,
  ForEachNode,
  EndForEachNode,
} from '@/components/nodes';
import { SelectNodeDialog, type NodeType } from '@/components/select-node-dialog';
import { NodeConfigSheet } from '@/components/node-config-sheet';
import { updateAutomationDefinition } from '@/lib/actions/automations';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowPathIcon, PlayIcon, StopIcon, Cog6ToothIcon } from '@heroicons/react/24/solid';
import { toast } from 'sonner';
import type { NodeStatus } from '@/components/node-status-indicator';
import { parseBlockchainError } from '@/lib/error-utils';
import { AddNodeButtonEdge } from '@/components/add-node-button-edge';
import { AIChatButton } from '@/components/ai-chat-button';
import { AIChatPanel } from '@/components/ai-chat-panel';
import { AutomationExecutionsDialog } from '@/components/navbar-components/automation-executions-dialog';
import { useRouter } from 'next/navigation';

const nodeTypes: NodeTypes = {
  start: StartNode,
  swap: SwapNode,
  swapFromPLS: SwapFromPLSNode,
  swapToPLS: SwapToPLSNode,
  transfer: TransferNode,
  transferPLS: TransferPLSNode,
  addLiquidity: AddLiquidityNode,
  addLiquidityPLS: AddLiquidityPLSNode,
  removeLiquidity: RemoveLiquidityNode,
  removeLiquidityPLS: RemoveLiquidityPLSNode,
  checkBalance: CheckBalanceNode,
  checkTokenBalance: CheckTokenBalanceNode,
  checkLPTokenAmounts: CheckLPTokenAmountsNode,
  burnToken: BurnTokenNode,
  claimToken: ClaimTokenNode,
  getParent: GetParentNode,
  wait: WaitNode,
  loop: LoopNode,
  gasGuard: GasGuardNode,
  condition: ConditionNode,
  telegram: TelegramNode,
  variable: VariableNode,
  calculator: CalculatorNode,
  dexQuote: DexQuoteNode,
  forEach: ForEachNode,
  endForEach: EndForEachNode,
};

const edgeTypes: EdgeTypes = {
  buttonedge: AddNodeButtonEdge,
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
  betaFeatures: boolean;
  communityVisible: boolean;
  activeExecution?: { id: string; status: string } | null;
  triggerMode: 'MANUAL' | 'SCHEDULE' | 'PRICE_TRIGGER';
  cronExpression: string | null;
  nextRunAt: Date | null;
  // Price trigger props
  priceTriggerLpAddress: string | null;
  priceTriggerOperator: string | null;
  priceTriggerValue: number | null;
  priceTriggerCooldownMinutes: number | null;
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
  betaFeatures: initialBetaFeatures,
  communityVisible: initialCommunityVisible,
  activeExecution,
  triggerMode: initialTriggerMode,
  cronExpression: initialCronExpression,
  nextRunAt: initialNextRunAt,
  priceTriggerLpAddress: initialPriceTriggerLpAddress,
  priceTriggerOperator: initialPriceTriggerOperator,
  priceTriggerValue: initialPriceTriggerValue,
  priceTriggerCooldownMinutes: initialPriceTriggerCooldownMinutes,
}: AutomationFlowProps) {
  const nodesToUse = useMemo(() => {
    if (initialNodes && initialNodes.length > 0) {
      return initialNodes;
    }
    return defaultStartNode;
  }, [initialNodes]);

  const [nodes, setNodes] = useState<Node[]>(nodesToUse);
  const [edges, setEdges] = useState<Edge[]>((initialEdges || []).map(edge => ({
    ...edge,
    type: edge.type || 'buttonedge',
  })));
  const [plsBalance, setPlsBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sourceNodeId, setSourceNodeId] = useState<string | null>(null);
  const [sourceHandleId, setSourceHandleId] = useState<string | null>(null);
  const [targetNodeId, setTargetNodeId] = useState<string | null>(null);
  const router = useRouter();
  const [configSheetOpen, setConfigSheetOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(!!activeExecution);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(activeExecution?.id ?? null);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>({});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [showNodeLabels, setShowNodeLabels] = useState(initialShowNodeLabels);
  const [betaFeatures, setBetaFeatures] = useState(initialBetaFeatures);
  const [communityVisible, setCommunityVisible] = useState(initialCommunityVisible);
  const [currentRpcEndpoint, setCurrentRpcEndpoint] = useState(rpcEndpoint || PULSECHAIN_RPC);
  const [currentName, setCurrentName] = useState(automationName);
  const [currentDefaultSlippage, setCurrentDefaultSlippage] = useState(defaultSlippage);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<string | null>(null);
  const [nodesToDeleteCount, setNodesToDeleteCount] = useState(0);
  const [triggerMode, setTriggerMode] = useState(initialTriggerMode);
  const [cronExpression, setCronExpression] = useState(initialCronExpression);
  const [nextRunAt, setNextRunAt] = useState(initialNextRunAt);
  const [priceTriggerLpAddress, setPriceTriggerLpAddress] = useState(initialPriceTriggerLpAddress);
  const [priceTriggerOperator, setPriceTriggerOperator] = useState(initialPriceTriggerOperator);
  const [priceTriggerValue, setPriceTriggerValue] = useState(initialPriceTriggerValue);
  const [priceTriggerCooldownMinutes, setPriceTriggerCooldownMinutes] = useState(initialPriceTriggerCooldownMinutes);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [executionsDialogOpen, setExecutionsDialogOpen] = useState(false);

  // Check if user has Pro/Ultra for AI access
  const hasAiAccess = userPlan === 'PRO' || userPlan === 'ULTRA';

  // Handle AI flow update - update state directly without reload
  const handleAiFlowUpdated = useCallback((definition: { nodes: Node[]; edges: Edge[] }) => {
    setNodes(definition.nodes);
    setEdges(definition.edges.map(edge => ({
      ...edge,
      type: edge.type || 'buttonedge',
    })));
  }, []);

  // Fetch PLS balance
  const fetchBalance = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshingBalance(true);
    } else {
      setIsLoadingBalance(true);
    }

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
      setIsRefreshingBalance(false);
    }
  }, [walletAddress, currentRpcEndpoint]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

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
        type: edge.type || 'buttonedge',
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

  const handleOpenDialog = useCallback((nodeId: string, sourceHandle?: string) => {
    setSourceNodeId(nodeId);
    setSourceHandleId(sourceHandle || null);
    setTargetNodeId(null);
    setDialogOpen(true);
  }, []);

  const handleEdgeClick = useCallback((sourceId: string, targetId: string) => {
    setSourceNodeId(sourceId);
    setTargetNodeId(targetId);
    setDialogOpen(true);
  }, []);

  const handleInsertNodeBetween = useCallback(
    (sourceId: string, targetId: string, nodeType: NodeType) => {
      const sourceNode = nodes.find((n) => n.id === sourceId);
      const targetNode = nodes.find((n) => n.id === targetId);

      if (!sourceNode || !targetNode) return;

      const sourceHandleId = sourceNode.type === 'start' ? 'start-output'
        : sourceNode.type === 'forEach' ? 'forEach-body' : 'output';

      // forEach: insert both forEach + endForEach as a pair
      if (nodeType === 'forEach') {
        const ts = Date.now();
        const forEachId = `forEach-${ts}`;
        const endForEachId = `endForEach-${ts}`;

        const thirdX = sourceNode.position.x + (targetNode.position.x - sourceNode.position.x) / 3;
        const twoThirdX = sourceNode.position.x + ((targetNode.position.x - sourceNode.position.x) * 2) / 3;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2;

        const forEachNode: Node = {
          id: forEachId,
          position: { x: thirdX, y: midY },
          data: { config: { pairedEndNodeId: endForEachId } },
          type: 'forEach',
        };
        const endForEachNode: Node = {
          id: endForEachId,
          position: { x: twoThirdX, y: midY },
          data: { config: { pairedForEachNodeId: forEachId } },
          type: 'endForEach',
        };

        setNodes((prev) => [...prev, forEachNode, endForEachNode]);
        setEdges((prev) => {
          const filtered = prev.filter(
            (edge) => !(edge.source === sourceId && edge.target === targetId)
          );
          return [
            ...filtered,
            { id: `edge-${sourceId}-${forEachId}`, source: sourceId, target: forEachId, sourceHandle: sourceHandleId, type: 'buttonedge' as const },
            { id: `edge-${forEachId}-${endForEachId}`, source: forEachId, target: endForEachId, sourceHandle: 'forEach-body', type: 'buttonedge' as const },
            { id: `edge-${endForEachId}-${targetId}`, source: endForEachId, target: targetId, sourceHandle: 'output', type: 'buttonedge' as const },
          ];
        });
        return;
      }

      // Calculate position midway between source and target
      const midX = (sourceNode.position.x + targetNode.position.x) / 2;
      const midY = (sourceNode.position.y + targetNode.position.y) / 2;

      const newNodeId = `${nodeType}-${Date.now()}`;
      const newNode: Node = {
        id: newNodeId,
        position: {
          x: midX,
          y: midY,
        },
        data: {},
        type: nodeType,
      };

      // Remove the old edge between source and target
      setEdges((prevEdges) => {
        const filteredEdges = prevEdges.filter(
          (edge) => !(edge.source === sourceId && edge.target === targetId)
        );

        // Add two new edges: source -> new node -> target
        return [
          ...filteredEdges,
          {
            id: `edge-${sourceId}-${newNodeId}`,
            source: sourceId,
            target: newNodeId,
            sourceHandle: sourceHandleId,
            type: 'buttonedge',
          },
          {
            id: `edge-${newNodeId}-${targetId}`,
            source: newNodeId,
            target: targetId,
            type: 'buttonedge',
          },
        ];
      });

      setNodes((prevNodes) => [...prevNodes, newNode]);
    },
    [nodes],
  );

  const handleAddNode = useCallback(
    (nodeType: NodeType) => {
      if (!sourceNodeId) return;

      // If targetNodeId is set, we're inserting between nodes
      if (targetNodeId) {
        handleInsertNodeBetween(sourceNodeId, targetNodeId, nodeType);
        setSourceNodeId(null);
        setSourceHandleId(null);
        setTargetNodeId(null);
        return;
      }

      // Otherwise, append to the end
      const sourceNode = nodes.find((n) => n.id === sourceNodeId);
      if (!sourceNode) return;

      // Determine source handle
      let edgeSourceHandle = sourceHandleId;
      if (!edgeSourceHandle) {
        edgeSourceHandle = sourceNode.type === 'start' ? 'start-output'
          : sourceNode.type === 'forEach' ? 'forEach-body' : 'output';
      }

      // Calculate position based on whether this is a condition branch
      let newX = sourceNode.position.x + 250;
      let newY = sourceNode.position.y;

      // If coming from a condition node, position based on branch
      if (sourceNode.type === 'condition' && sourceHandleId) {
        if (sourceHandleId === 'output-true') {
          newX = sourceNode.position.x + 150;
          newY = sourceNode.position.y + 150;
        } else if (sourceHandleId === 'output-false') {
          newX = sourceNode.position.x - 150;
          newY = sourceNode.position.y + 150;
        }
      }

      // forEach: spawn both forEach and endForEach as a pair
      if (nodeType === 'forEach') {
        const ts = Date.now();
        const forEachId = `forEach-${ts}`;
        const endForEachId = `endForEach-${ts}`;

        const forEachNode: Node = {
          id: forEachId,
          position: { x: newX, y: newY },
          data: { config: { pairedEndNodeId: endForEachId } },
          type: 'forEach',
        };
        const endForEachNode: Node = {
          id: endForEachId,
          position: { x: newX + 250, y: newY },
          data: { config: { pairedForEachNodeId: forEachId } },
          type: 'endForEach',
        };

        setNodes((prev) => [...prev, forEachNode, endForEachNode]);
        setEdges((prev) => [
          ...prev,
          { id: `edge-${sourceNodeId}-${forEachId}`, source: sourceNodeId, target: forEachId, sourceHandle: edgeSourceHandle, type: 'buttonedge' as const },
          { id: `edge-${forEachId}-${endForEachId}`, source: forEachId, target: endForEachId, sourceHandle: 'forEach-body', type: 'buttonedge' as const },
        ]);
        setSourceNodeId(null);
        setSourceHandleId(null);
        return;
      }

      const newNodeId = `${nodeType}-${Date.now()}`;

      const newNode: Node = {
        id: newNodeId,
        position: {
          x: newX,
          y: newY,
        },
        data: {},
        type: nodeType,
      };

      const newEdge: Edge = {
        id: `edge-${sourceNodeId}-${newNodeId}`,
        source: sourceNodeId,
        target: newNodeId,
        sourceHandle: edgeSourceHandle,
        type: 'buttonedge',
      };

      setNodes((prevNodes) => [...prevNodes, newNode]);
      setEdges((prevEdges) => [...prevEdges, newEdge]);
      setSourceNodeId(null);
      setSourceHandleId(null);
    },
    [nodes, sourceNodeId, sourceHandleId, targetNodeId, handleInsertNodeBetween],
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

  // Get all nodes that come after a given node in the chain (handles branching)
  const getNodesAfter = useCallback((nodeId: string): string[] => {
    const result: string[] = [];
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Find all outgoing edges from this node
      const outgoingEdges = edges.filter((e) => e.source === currentId);
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          result.push(edge.target);
          queue.push(edge.target);
        }
      }
    }

    return result;
  }, [edges]);

  // Get all body node IDs between a forEach node and its paired endForEach
  const getForEachBodyNodes = useCallback((forEachNodeId: string, endForEachNodeId: string): string[] => {
    const bodyNodes: string[] = [];
    const visited = new Set<string>();
    const queue = [forEachNodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const outgoing = edges.filter((e) => e.source === currentId);
      for (const edge of outgoing) {
        if (edge.target === endForEachNodeId || visited.has(edge.target)) continue;
        bodyNodes.push(edge.target);
        queue.push(edge.target);
      }
    }
    return bodyNodes;
  }, [edges]);

  // Find the paired forEach or endForEach node id for a given node
  const findForEachPair = useCallback((node: Node): { forEachId: string; endForEachId: string } | null => {
    const config = (node.data as any)?.config;
    if (node.type === 'forEach' && config?.pairedEndNodeId) {
      return { forEachId: node.id, endForEachId: config.pairedEndNodeId };
    }
    if (node.type === 'endForEach' && config?.pairedForEachNodeId) {
      return { forEachId: config.pairedForEachNodeId, endForEachId: node.id };
    }
    return null;
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);

    if (node?.type === 'condition') {
      const nodesAfter = getNodesAfter(nodeId);
      setNodesToDeleteCount(nodesAfter.length + 1);
    } else if (node?.type === 'forEach' || node?.type === 'endForEach') {
      const pair = findForEachPair(node);
      if (pair) {
        const bodyNodes = getForEachBodyNodes(pair.forEachId, pair.endForEachId);
        // forEach + endForEach + body nodes
        setNodesToDeleteCount(2 + bodyNodes.length);
      } else {
        setNodesToDeleteCount(1);
      }
    } else {
      setNodesToDeleteCount(1);
    }

    setNodeToDelete(nodeId);
    setDeleteDialogOpen(true);
  }, [nodes, getNodesAfter, findForEachPair, getForEachBodyNodes]);

  const confirmDeleteNode = useCallback(() => {
    if (!nodeToDelete) return;

    const nodeToDeleteData = nodes.find((n) => n.id === nodeToDelete);

    // Condition nodes: use cascading delete (current behavior)
    if (nodeToDeleteData?.type === 'condition') {
      const nodesAfter = getNodesAfter(nodeToDelete);
      const nodeIdsToDelete = new Set([nodeToDelete, ...nodesAfter]);
      setNodes((prevNodes) => prevNodes.filter((node) => !nodeIdsToDelete.has(node.id)));
      setEdges((prevEdges) =>
        prevEdges.filter((edge) => !nodeIdsToDelete.has(edge.source) && !nodeIdsToDelete.has(edge.target))
      );
    } else if (nodeToDeleteData && (nodeToDeleteData.type === 'forEach' || nodeToDeleteData.type === 'endForEach')) {
      // forEach / endForEach: cascading delete of both + body nodes, reconnect chain
      const pair = findForEachPair(nodeToDeleteData);
      if (pair) {
        const bodyNodes = getForEachBodyNodes(pair.forEachId, pair.endForEachId);
        const nodeIdsToDelete = new Set([pair.forEachId, pair.endForEachId, ...bodyNodes]);

        // Find edges to bridge: incoming to forEach, outgoing from endForEach
        const incomingEdge = edges.find((e) => e.target === pair.forEachId);
        const outgoingEdge = edges.find((e) => e.source === pair.endForEachId);

        setNodes((prevNodes) => prevNodes.filter((node) => !nodeIdsToDelete.has(node.id)));
        setEdges((prevEdges) => {
          const filtered = prevEdges.filter(
            (edge) => !nodeIdsToDelete.has(edge.source) && !nodeIdsToDelete.has(edge.target)
          );
          // Bridge the gap if both edges exist
          if (incomingEdge && outgoingEdge) {
            const bridgeEdge: Edge = {
              id: `edge-${incomingEdge.source}-${outgoingEdge.target}`,
              source: incomingEdge.source,
              target: outgoingEdge.target,
              sourceHandle: incomingEdge.sourceHandle,
              type: 'buttonedge',
            };
            return [...filtered, bridgeEdge];
          }
          return filtered;
        });
      } else {
        // Orphaned forEach/endForEach — just delete it as a regular node
        const incomingEdge = edges.find((e) => e.target === nodeToDelete);
        const outgoingEdge = edges.find((e) => e.source === nodeToDelete);
        setNodes((prevNodes) => prevNodes.filter((node) => node.id !== nodeToDelete));
        setEdges((prevEdges) => {
          const filtered = prevEdges.filter(
            (edge) => edge.source !== nodeToDelete && edge.target !== nodeToDelete
          );
          if (incomingEdge && outgoingEdge) {
            return [...filtered, {
              id: `edge-${incomingEdge.source}-${outgoingEdge.target}`,
              source: incomingEdge.source,
              target: outgoingEdge.target,
              sourceHandle: incomingEdge.sourceHandle,
              type: 'buttonedge' as const,
            }];
          }
          return filtered;
        });
      }
    } else {
      // Regular nodes: delete only this node, reconnect previous to next
      const incomingEdge = edges.find((e) => e.target === nodeToDelete);
      const outgoingEdge = edges.find((e) => e.source === nodeToDelete);

      // Remove the node
      setNodes((prevNodes) => prevNodes.filter((node) => node.id !== nodeToDelete));

      // Update edges: remove connected edges, add reconnection edge if applicable
      setEdges((prevEdges) => {
        const filtered = prevEdges.filter(
          (edge) => edge.source !== nodeToDelete && edge.target !== nodeToDelete
        );

        // If both incoming and outgoing exist, create bridge edge
        if (incomingEdge && outgoingEdge) {
          const bridgeEdge: Edge = {
            id: `edge-${incomingEdge.source}-${outgoingEdge.target}`,
            source: incomingEdge.source,
            target: outgoingEdge.target,
            sourceHandle: incomingEdge.sourceHandle,
            type: 'buttonedge',
          };
          return [...filtered, bridgeEdge];
        }
        return filtered;
      });
    }

    // Close config sheet if open for deleted node
    if (selectedNodeId === nodeToDelete) {
      setConfigSheetOpen(false);
      setSelectedNodeId(null);
    }

    // Reset dialog state
    setDeleteDialogOpen(false);
    setNodeToDelete(null);
    setNodesToDeleteCount(0);
  }, [nodeToDelete, nodes, edges, getNodesAfter, findForEachPair, getForEachBodyNodes, selectedNodeId]);

  const handleStart = useCallback(async () => {
    setIsRunning(true);
    // Reset all node statuses
    setNodeStatuses({});

    // Create new AbortController for this execution
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/automations/${automationId}/run`, {
        method: 'POST',
        signal: abortControllerRef.current.signal,
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
            } else if (data.type === 'cancelled') {
              // Handle cancellation event
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
              } else if (data.cancelled) {
                toast.info('Automation stopped');
              } else {
                toast.error(data.error || 'Automation failed');
              }
            }
          }
        }
      }
    } catch (error) {
      // Ignore abort errors - they're expected when stopping
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      const parsed = parseBlockchainError(error);
      console.error('Automation error details:', parsed.technicalDetails);
      toast.error(parsed.userMessage);
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  }, [automationId, walletAddress, currentRpcEndpoint]);

  const handleStop = useCallback(async () => {
    setStopDialogOpen(false);

    try {
      // Call the stop endpoint to cancel the execution
      const response = await fetch(`/api/automations/${automationId}/stop`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to stop automation');
        return;
      }

      // Abort the stream reader
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      toast.info('Stopping automation...');
    } catch (error) {
      console.error('Error stopping automation:', error);
      toast.error('Failed to stop automation');
    }
  }, [automationId]);

  const lastNodeIds = useMemo(() => {
    // Find ALL nodes that have no outgoing edges (supports branching with multiple terminal nodes)
    const nodesWithOutgoingEdges = new Set(edges.map((edge) => edge.source));
    return new Set(
      nodes
        .filter((node) => !nodesWithOutgoingEdges.has(node.id))
        .map((node) => node.id)
    );
  }, [nodes, edges]);

  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => {
      const isLastNode = lastNodeIds.has(node.id);
      const status = nodeStatuses[node.id] || 'initial';

      // For condition nodes, check which branches have connections
      let conditionData: {
        hasTrueBranch: boolean;
        hasFalseBranch: boolean;
        onAddNode: (sourceHandle: string) => void;
      } | null = null;
      if (node.type === 'condition') {
        const hasTrueBranch = edges.some(
          (e) => e.source === node.id && e.sourceHandle === 'output-true'
        );
        const hasFalseBranch = edges.some(
          (e) => e.source === node.id && e.sourceHandle === 'output-false'
        );
        conditionData = {
          hasTrueBranch,
          hasFalseBranch,
          onAddNode: (sourceHandle: string) => handleOpenDialog(node.id, sourceHandle),
        };
      }

      return {
        ...node,
        data: {
          ...node.data,
          onAddNode: node.type === 'condition' && conditionData
            ? conditionData.onAddNode
            : (isLastNode ? () => handleOpenDialog(node.id) : undefined),
          onNodeClick: () => handleNodeClick(node.id),
          isLastNode,
          status,
          showNodeLabels,
          // Pass schedule data to start node
          ...(node.type === 'start' ? { triggerMode, cronExpression, nextRunAt } : {}),
          // Pass condition-specific data
          ...(node.type === 'condition' && conditionData ? conditionData : {}),
        },
      };
    });
  }, [nodes, edges, handleOpenDialog, lastNodeIds, handleNodeClick, nodeStatuses, showNodeLabels, triggerMode, cronExpression, nextRunAt]);

  const handleReset = useCallback(() => {
    // Keep only the start node(s)
    const startNodes = nodes.filter((node) => node.type === 'start');

    // If no start node exists, create a default one
    if (startNodes.length === 0) {
      setNodes(defaultStartNode);
    } else {
      // Keep only the first start node (or all if multiple exist)
      setNodes(startNodes.length === 1 ? startNodes : [startNodes[0]]);
    }

    // Clear all edges
    setEdges([]);

    // Close config sheet if open
    setConfigSheetOpen(false);
    setSelectedNodeId(null);

    toast.success('Automation reset - all nodes except start node removed');
  }, [nodes]);

  const handleDelete = useCallback(async () => {
    try {
      const response = await fetch(`/api/automations/${automationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete automation');
        return;
      }

      toast.success('Automation deleted successfully');
      // Redirect to automations list
      window.location.href = '/automations';
    } catch (error) {
      const parsed = parseBlockchainError(error);
      console.error('Delete automation error:', parsed.technicalDetails);
      toast.error(parsed.userMessage);
    }
  }, [automationId]);

  return (
    <div className="w-full h-[calc(100vh-4rem)] dark relative">
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edges.map(edge => ({
          ...edge,
          type: edge.type || 'buttonedge',
          data: {
            ...edge.data,
            onEdgeClick: handleEdgeClick,
          },
        }))}
        proOptions={{ hideAttribution: true }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesConnectable={false}
        fitView
      >
        <Background />
      </ReactFlow>
      <SelectNodeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSelectNode={handleAddNode}
        userPlan={userPlan}
        isInsertingBetween={!!targetNodeId}
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
          automationId={automationId}
          walletAddress={walletAddress}
          userPlan={userPlan}
          triggerMode={triggerMode}
          cronExpression={cronExpression}
          onScheduleUpdate={(newTriggerMode, newCronExpression, newNextRunAt) => {
            setTriggerMode(newTriggerMode);
            setCronExpression(newCronExpression);
            setNextRunAt(newNextRunAt);
          }}
          priceTriggerLpAddress={priceTriggerLpAddress}
          priceTriggerOperator={priceTriggerOperator}
          priceTriggerValue={priceTriggerValue}
          priceTriggerCooldownMinutes={priceTriggerCooldownMinutes}
          onPriceTriggerUpdate={(lpAddress, operator, value, cooldownMinutes) => {
            setPriceTriggerLpAddress(lpAddress);
            setPriceTriggerOperator(operator);
            setPriceTriggerValue(value);
            setPriceTriggerCooldownMinutes(cooldownMinutes);
          }}
        />
      )}
      <div className="absolute top-4 left-4 z-10 rounded-lg bg-card border px-3 py-2 shadow-lg min-w-[280px]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-muted-foreground">Automation</div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchBalance(true)}
              disabled={isRefreshingBalance}
              className="h-6 w-6"
              title="Refresh balance"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/automations/${automationId}/settings`)}
              className="h-6 w-6"
            >
              <Cog6ToothIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-sm font-semibold mb-3">{currentName}</div>

        <div className="text-xs text-muted-foreground mt-3 mb-1">Wallet Address</div>
        <button
          onClick={copyToClipboard}
          className="text-sm hover:text-foreground transition-colors cursor-pointer text-left w-full"
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
        <div className="text-sm">
          {isLoadingBalance ? 'Loading...' : `${plsBalance} PLS`}
        </div>
        <Button
          className='w-full mt-5 mb-1'
          size={"sm"}
          variant={"outline"}
          onClick={() => setExecutionsDialogOpen(true)}
        >
          Executions
        </Button>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Node</AlertDialogTitle>
            <AlertDialogDescription>
              {nodesToDeleteCount > 1
                ? `This will delete this node and ${nodesToDeleteCount - 1} node${nodesToDeleteCount - 1 === 1 ? '' : 's'} that come after it. This action cannot be undone.`
                : 'This will delete this node and reconnect the flow. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteNode} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={stopDialogOpen} onOpenChange={setStopDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Automation</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the automation after the current node finishes. Already executed transactions cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStop} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Stop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Player Controls - Bottom Center */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-10">
        <div className="rounded-full bg-card border shadow-lg px-4 py-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            disabled={isRunning || triggerMode === 'SCHEDULE'}
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
            onClick={() => setStopDialogOpen(true)}
            className="rounded-full h-10 w-10 text-destructive hover:text-destructive"
          >
            <StopIcon className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* AI Assistant - Bottom Right */}
      {betaFeatures && (
        <div className="absolute bottom-7 right-7 z-10 shadow-lg">
          <AIChatButton
            onClick={() => setAiChatOpen(!aiChatOpen)}
            isOpen={aiChatOpen}
            disabled={!hasAiAccess}
          />
        </div>
      )}

      {betaFeatures && hasAiAccess && (
        <AIChatPanel
          automationId={automationId}
          isOpen={aiChatOpen}
          onClose={() => setAiChatOpen(false)}
          onFlowUpdated={handleAiFlowUpdated}
        />
      )}

      <AutomationExecutionsDialog
        automationId={automationId}
        open={executionsDialogOpen}
        onOpenChange={setExecutionsDialogOpen}
      />
    </div>
  );
}
