import type { Node, Edge } from '@xyflow/react';
import { executeNode } from './blockchain-functions';
import { createExecutionContext, type ExecutionContext } from './execution-context';
import { parseBlockchainError } from './error-utils';
import { prisma } from './prisma';

export type ProgressEventType = 'node_start' | 'node_complete' | 'node_error' | 'branch_taken' | 'cancelled';

export interface ProgressEvent {
  type: ProgressEventType;
  nodeId: string;
  nodeType: string;
  data?: any;
  error?: string;
}

export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Check if an execution has been cancelled
 */
async function isExecutionCancelled(executionId: string): Promise<boolean> {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    select: { status: true },
  });
  return execution?.status === 'CANCELLED';
}

/**
 * Execute an automation chain of nodes with branching support
 * Handles condition nodes that branch to true/false paths
 * Supports loop nodes that restart the chain from the beginning
 * Supports cancellation via executionId check
 */
export async function executeAutomationChain(
  automationId: string,
  nodes: Node[],
  edges: Edge[],
  contractAddress?: string,
  onProgress?: ProgressCallback,
  executionId?: string
): Promise<{ results: Array<{ nodeId: string; result: any }>; context: ExecutionContext }> {
  // Build graph structures for traversal
  const nodeMap = new Map<string, Node>();
  const outgoingEdges = new Map<string, Edge[]>();
  
  nodes.forEach((node) => {
    nodeMap.set(node.id, node);
  });
  
  edges.forEach((edge) => {
    const existing = outgoingEdges.get(edge.source) || [];
    existing.push(edge);
    outgoingEdges.set(edge.source, existing);
  });
  
  // Find start node
  const startNode = nodes.find((n) => n.type === 'start');
  if (!startNode) {
    throw new Error('No start node found in automation');
  }
  
  // Initialize context with loop tracking
  let context = createExecutionContext();
  (context as any).currentIteration = 0;
  
  const allResults: Array<{ nodeId: string; result: any }> = [];
  let maxLoopCount = 1;
  let currentIteration = 0;
  
  // Execute with loop support
  do {
    currentIteration++;
    (context as any).currentIteration = currentIteration;
    
    // Reset context outputs for new iteration (keep iteration count)
    if (currentIteration > 1) {
      context.nodeOutputs = new Map();
      context.previousNodeId = null;
      context.previousNodeType = null;
    }
    
    // Start execution from start node and traverse the graph
    const executedNodes = new Set<string>();
    
    // Get the first node after start
    const startEdges = outgoingEdges.get(startNode.id) || [];
    let currentNodeIds: string[] = startEdges.map((e) => e.target);
    
    // Execute nodes in order, handling branching
    while (currentNodeIds.length > 0) {
      const nodeId = currentNodeIds.shift()!;
      
      // Skip if already executed in this iteration
      if (executedNodes.has(nodeId)) {
        continue;
      }
      
      const node = nodeMap.get(nodeId);
      if (!node || !node.type) {
        continue;
      }
      
      // Check for cancellation before executing each node
      if (executionId && await isExecutionCancelled(executionId)) {
        onProgress?.({
          type: 'cancelled',
          nodeId: node.id,
          nodeType: node.type,
          error: 'Execution cancelled by user',
        });
        throw new Error('Execution cancelled by user');
      }
      
      executedNodes.add(nodeId);
      
      const nodeData = {
        ...(node.data?.config || {}),
        nodeId: node.id,
      };
      
      // Notify: node starting
      onProgress?.({
        type: 'node_start',
        nodeId: node.id,
        nodeType: node.type,
        data: currentIteration > 1 ? { iteration: currentIteration } : undefined,
      });
      
      try {
        // Execute node with current context
        const { result, context: updatedContext } = await executeNode(
          automationId,
          node.type,
          nodeData,
          context,
          contractAddress
        );
        
        // Update context for next node
        context = updatedContext;
        
        // Track loop configuration if this is a loop node
        if (node.type === 'loop' && result?.loopCount) {
          maxLoopCount = Math.min(3, Math.max(1, result.loopCount));
        }
        
        allResults.push({
          nodeId: node.id,
          result: { ...result, iteration: currentIteration },
        });
        
        // Notify: node completed
        onProgress?.({
          type: 'node_complete',
          nodeId: node.id,
          nodeType: node.type,
          data: { ...result, iteration: currentIteration },
        });
        
        // Determine next nodes to execute
        const nodeOutgoingEdges = outgoingEdges.get(node.id) || [];
        
        if (node.type === 'condition' && result?.branchToFollow) {
          // For condition nodes, only follow the matching branch
          const branchToFollow = result.branchToFollow; // 'true' or 'false'
          const expectedHandle = branchToFollow === 'true' ? 'output-true' : 'output-false';
          
          const branchEdge = nodeOutgoingEdges.find(
            (e) => e.sourceHandle === expectedHandle
          );
          
          if (branchEdge) {
            currentNodeIds.push(branchEdge.target);
            
            // Notify: branch taken
            onProgress?.({
              type: 'branch_taken',
              nodeId: node.id,
              nodeType: node.type,
              data: { branch: branchToFollow, nextNodeId: branchEdge.target },
            });
          }
          // If no branch edge exists for the result, execution stops here
        } else {
          // For non-condition nodes, follow all outgoing edges (usually just one)
          for (const edge of nodeOutgoingEdges) {
            if (!executedNodes.has(edge.target)) {
              currentNodeIds.push(edge.target);
            }
          }
        }
      } catch (error) {
        const parsed = parseBlockchainError(error);
        
        // Log technical details for debugging
        console.error(`[${node.type}] Technical error:`, parsed.technicalDetails);
        
        // Notify: node error with user-friendly message
        onProgress?.({
          type: 'node_error',
          nodeId: node.id,
          nodeType: node.type,
          error: parsed.userMessage,
        });
        
        // If a node fails, stop execution with user-friendly message
        throw new Error(
          `${node.type} failed: ${parsed.userMessage}${parsed.isRetryable ? ' (retryable)' : ''}`
        );
      }
    }
  } while (currentIteration < maxLoopCount);
  
  return { results: allResults, context };
}

/**
 * Get execution order of nodes based on edges (topological sort)
 * Returns array of node IDs in execution order
 * Note: This doesn't handle branching - use for linear flows only
 * @deprecated Use executeAutomationChain which handles branching dynamically
 */
function getExecutionOrder(nodes: Node[], edges: Edge[]): string[] {
  // Build adjacency list
  const graph: Map<string, string[]> = new Map();
  const inDegree: Map<string, number> = new Map();
  
  // Initialize
  nodes.forEach((node) => {
    graph.set(node.id, []);
    inDegree.set(node.id, 0);
  });
  
  // Build graph from edges
  edges.forEach((edge) => {
    const source = edge.source;
    const target = edge.target;
    
    if (!graph.has(source) || !graph.has(target)) {
      return; // Skip invalid edges
    }
    
    graph.get(source)!.push(target);
    inDegree.set(target, (inDegree.get(target) || 0) + 1);
  });
  
  // Find start nodes (nodes with no incoming edges)
  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });
  
  const order: string[] = [];
  
  // Process nodes
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    order.push(nodeId);
    
    const neighbors = graph.get(nodeId) || [];
    neighbors.forEach((neighbor) => {
      const currentInDegree = inDegree.get(neighbor) || 0;
      inDegree.set(neighbor, currentInDegree - 1);
      
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    });
  }
  
  return order;
}
