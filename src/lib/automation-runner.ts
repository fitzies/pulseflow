import type { Node, Edge } from '@xyflow/react';
import { executeNode } from './blockchain-functions';
import { createExecutionContext, type ExecutionContext } from './execution-context';

export type ProgressEventType = 'node_start' | 'node_complete' | 'node_error';

export interface ProgressEvent {
  type: ProgressEventType;
  nodeId: string;
  nodeType: string;
  data?: any;
  error?: string;
}

export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Execute an automation chain of nodes sequentially
 * Passes execution context between nodes for variable resolution
 */
export async function executeAutomationChain(
  automationId: string,
  nodes: Node[],
  edges: Edge[],
  contractAddress?: string,
  onProgress?: ProgressCallback
): Promise<{ results: Array<{ nodeId: string; result: any }>; context: ExecutionContext }> {
  // Build execution order from edges (topological sort)
  const executionOrder = getExecutionOrder(nodes, edges);
  
  // Initialize context
  let context = createExecutionContext();
  
  const results: Array<{ nodeId: string; result: any }> = [];
  
  // Execute each node in order
  for (const nodeId of executionOrder) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !node.type || node.type === 'start') {
      continue; // Skip start nodes and invalid nodes
    }
    
    const nodeData = {
      ...(node.data?.config || {}),
      nodeId: node.id,
    };
    
    // Notify: node starting
    onProgress?.({
      type: 'node_start',
      nodeId: node.id,
      nodeType: node.type,
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
      
      results.push({
        nodeId: node.id,
        result,
      });
      
      // Notify: node completed
      onProgress?.({
        type: 'node_complete',
        nodeId: node.id,
        nodeType: node.type,
        data: result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Notify: node error
      onProgress?.({
        type: 'node_error',
        nodeId: node.id,
        nodeType: node.type,
        error: errorMessage,
      });
      
      // If a node fails, stop execution
      throw new Error(
        `Node ${nodeId} (${node.type}) failed: ${errorMessage}`
      );
    }
  }
  
  return { results, context };
}

/**
 * Get execution order of nodes based on edges (topological sort)
 * Returns array of node IDs in execution order
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
