import type { Node, Edge } from '@xyflow/react';
import { executeNode } from './blockchain-functions';
import { createExecutionContext, resolveForEachAddresses, type ExecutionContext } from './execution-context';
import { parseBlockchainError } from './error-utils';
import { prisma } from './prisma';
import { serializeForPrisma } from './serialization';

export type ProgressEventType = 'node_start' | 'node_complete' | 'node_error' | 'branch_taken' | 'cancelled';

export interface ProgressEvent {
  type: ProgressEventType;
  nodeId: string;
  nodeType: string;
  data?: any;
  error?: string;
}

export type ProgressCallback = (event: ProgressEvent) => void;

async function safeCreateExecutionLog(args: {
  executionId: string;
  nodeId: string;
  nodeType: string;
  input?: unknown;
}): Promise<string | null> {
  try {
    const created = await prisma.executionLog.create({
      data: {
        executionId: args.executionId,
        nodeId: args.nodeId,
        nodeType: args.nodeType,
        input: args.input === undefined ? undefined : serializeForPrisma(args.input),
      },
      select: { id: true },
    });
    return created.id;
  } catch (e) {
    console.error('[executionLog] Failed to create log row:', e);
    return null;
  }
}

async function safeUpdateExecutionLog(args: {
  logId: string | null;
  output?: unknown;
  error?: unknown;
}): Promise<void> {
  if (!args.logId) return;
  try {
    await prisma.executionLog.update({
      where: { id: args.logId },
      data: {
        output: args.output === undefined ? undefined : serializeForPrisma(args.output),
        error: args.error === undefined ? undefined : String(args.error),
      },
    });
  } catch (e) {
    console.error('[executionLog] Failed to update log row:', e);
  }
}

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
 * Supports loop nodes that restart the chain from the beginning when encountered
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
  
  // Track loop nodes and their restart counts
  const loopNodeRestartCounts = new Map<string, number>();
  
  // Initialize context
  let context = createExecutionContext();
  (context as any).currentIteration = 0;
  
  const allResults: Array<{ nodeId: string; result: any }> = [];
  let restartCount = 0;
  
  // Execute with loop support - restart from start when loop node is encountered
  while (true) {
    restartCount++;
    (context as any).currentIteration = restartCount;
    
    // Reset context outputs for new iteration (keep iteration count)
    if (restartCount > 1) {
      context.nodeOutputs = new Map();
      context.previousNodeId = null;
      context.previousNodeType = null;
    }
    
    // Start execution from start node and traverse the graph
    const executedNodes = new Set<string>();
    
    // Get the first node after start
    const startEdges = outgoingEdges.get(startNode.id) || [];
    let currentNodeIds: string[] = startEdges.map((e) => e.target);
    let shouldRestart = false;
    
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

      // Handle forEach node — execute body nodes for each item, then skip to after endForEach
      if (node.type === 'forEach') {
        const forEachConfig = (node.data as any)?.config || {};
        const items: string[] = forEachConfig.items || [];
        const pairedEndNodeId: string | undefined = forEachConfig.pairedEndNodeId;

        // Find endForEach node and collect body node IDs between forEach and endForEach
        const bodyNodeIds: string[] = [];
        const endForEachNodeId = (() => {
          const visited = new Set<string>();
          const queue = [node.id];
          while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            const currentOutgoing = outgoingEdges.get(currentId) || [];
            for (const edge of currentOutgoing) {
              const targetNode = nodeMap.get(edge.target);
              if (targetNode?.type === 'endForEach') return targetNode.id;
              if (!visited.has(edge.target)) {
                bodyNodeIds.push(edge.target);
                queue.push(edge.target);
              }
            }
          }
          return pairedEndNodeId || null;
        })();

        if (!endForEachNodeId) {
          throw new Error('forEach node has no paired endForEach node');
        }

        // Validate: no nested forEach or repeat nodes in body
        for (const bodyId of bodyNodeIds) {
          const bodyNode = nodeMap.get(bodyId);
          if (bodyNode?.type === 'forEach') throw new Error('Nested For-Each blocks are not supported');
          if (bodyNode?.type === 'loop') throw new Error('Repeat node cannot be inside a For-Each body');
        }

        onProgress?.({
          type: 'node_start',
          nodeId: node.id,
          nodeType: 'forEach',
          data: { totalItems: items.length },
        });

        if (items.length === 0) {
          // Empty list: skip body, continue past endForEach
          onProgress?.({
            type: 'node_complete',
            nodeId: node.id,
            nodeType: 'forEach',
            data: { totalItems: 0, skipped: true },
          });
          executedNodes.add(endForEachNodeId);
          const endForEachOutgoing = outgoingEdges.get(endForEachNodeId) || [];
          for (const edge of endForEachOutgoing) {
            if (!executedNodes.has(edge.target)) {
              currentNodeIds.push(edge.target);
            }
          }
          continue;
        }

        // Iterate over each item
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
          context.forEachItem = { address: items[itemIndex], index: itemIndex, total: items.length };

          // Clear body nodes from executedNodes and their outputs so they can re-execute
          for (const bodyId of bodyNodeIds) {
            executedNodes.delete(bodyId);
            context.nodeOutputs.delete(bodyId);
          }
          // Also clear endForEach
          executedNodes.delete(endForEachNodeId);
          context.nodeOutputs.delete(endForEachNodeId);

          // Set previous node to forEach so body nodes can reference its output
          context.previousNodeId = node.id;
          context.previousNodeType = 'forEach';
          context.nodeOutputs.set(node.id, {
            currentAddress: items[itemIndex],
            currentIndex: itemIndex,
            totalItems: items.length,
          });

          // BFS through body nodes for this iteration
          const forEachStartEdges = outgoingEdges.get(node.id) || [];
          const bodyQueue: string[] = forEachStartEdges.map((e) => e.target);

          while (bodyQueue.length > 0) {
            const bodyNodeId = bodyQueue.shift()!;
            if (executedNodes.has(bodyNodeId)) continue;

            const bodyNode = nodeMap.get(bodyNodeId);
            if (!bodyNode || !bodyNode.type) continue;

            // endForEach: mark as executed, don't go further
            if (bodyNode.type === 'endForEach') {
              executedNodes.add(bodyNodeId);
              continue;
            }

            // Check for cancellation
            if (executionId && await isExecutionCancelled(executionId)) {
              onProgress?.({ type: 'cancelled', nodeId: bodyNode.id, nodeType: bodyNode.type, error: 'Execution cancelled by user' });
              throw new Error('Execution cancelled by user');
            }

            executedNodes.add(bodyNodeId);

            // Resolve forEach sentinels in node data
            const rawNodeData = { ...(bodyNode.data?.config || {}), nodeId: bodyNode.id };
            const resolvedNodeData = resolveForEachAddresses(rawNodeData, context);

            const bodyNodeNotes = bodyNode.data && typeof bodyNode.data === 'object'
              ? ((bodyNode.data as any)?.config?.notes as string | undefined)
              : undefined;

            onProgress?.({
              type: 'node_start',
              nodeId: bodyNode.id,
              nodeType: bodyNode.type,
              data: { forEachItem: itemIndex + 1, forEachTotal: items.length },
            });

            const bodyLogId = executionId
              ? await safeCreateExecutionLog({
                  executionId,
                  nodeId: bodyNode.id,
                  nodeType: bodyNode.type,
                  input: { ...resolvedNodeData, forEachItem: itemIndex + 1, forEachTotal: items.length },
                })
              : null;

            try {
              const { result: bodyResult, context: updatedCtx } = await executeNode(
                automationId,
                bodyNode.type,
                resolvedNodeData,
                context,
                contractAddress
              );
              context = updatedCtx;

              allResults.push({ nodeId: bodyNode.id, result: { ...bodyResult, forEachItem: itemIndex + 1 } });

              onProgress?.({
                type: 'node_complete',
                nodeId: bodyNode.id,
                nodeType: bodyNode.type,
                data: { ...bodyResult, forEachItem: itemIndex + 1, forEachTotal: items.length },
              });

              await safeUpdateExecutionLog({ logId: bodyLogId, output: { result: bodyResult, forEachItem: itemIndex + 1 } });

              // Determine next body nodes
              const bodyOutgoing = outgoingEdges.get(bodyNode.id) || [];
              if (bodyNode.type === 'condition' && bodyResult?.branchToFollow) {
                const expectedHandle = bodyResult.branchToFollow === 'true' ? 'output-true' : 'output-false';
                const branchEdge = bodyOutgoing.find((e) => e.sourceHandle === expectedHandle);
                if (branchEdge) {
                  bodyQueue.push(branchEdge.target);
                  onProgress?.({ type: 'branch_taken', nodeId: bodyNode.id, nodeType: bodyNode.type, data: { branch: bodyResult.branchToFollow, nextNodeId: branchEdge.target } });
                }
              } else {
                for (const edge of bodyOutgoing) {
                  if (!executedNodes.has(edge.target)) {
                    bodyQueue.push(edge.target);
                  }
                }
              }
            } catch (error) {
              const parsed = parseBlockchainError(error);
              console.error(`[${bodyNode.type}] Technical error:`, parsed.technicalDetails);
              await safeUpdateExecutionLog({ logId: bodyLogId, error: parsed.technicalDetails, output: { userMessage: parsed.userMessage, errorType: parsed.errorType, isRetryable: parsed.isRetryable, code: parsed.code, shortMessage: parsed.shortMessage, revertReason: parsed.revertReason, txHash: parsed.txHash } });
              onProgress?.({ type: 'node_error', nodeId: bodyNode.id, nodeType: bodyNode.type, error: parsed.txHash ? `${parsed.userMessage} (tx: ${parsed.txHash})` : parsed.userMessage });
              const txPart = parsed.txHash ? ` [tx: ${parsed.txHash}]` : '';
              const notesPart = bodyNodeNotes ? ` "${bodyNodeNotes}"` : '';
              throw new Error(`${bodyNode.type}${notesPart} (${bodyNode.id}) failed: ${parsed.userMessage}${txPart}${parsed.isRetryable ? ' (retryable)' : ''}`);
            }
          }
        }

        // All iterations complete — clear forEach context and continue past endForEach
        context.forEachItem = null;
        executedNodes.add(endForEachNodeId);

        onProgress?.({
          type: 'node_complete',
          nodeId: node.id,
          nodeType: 'forEach',
          data: { totalItems: items.length, completed: true },
        });

        const endForEachOutgoing = outgoingEdges.get(endForEachNodeId) || [];
        for (const edge of endForEachOutgoing) {
          if (!executedNodes.has(edge.target)) {
            currentNodeIds.push(edge.target);
          }
        }
        continue;
      }

      // Skip endForEach if encountered outside of forEach (shouldn't happen with paired spawn)
      if (node.type === 'endForEach') {
        const nodeOutgoingEdges = outgoingEdges.get(node.id) || [];
        for (const edge of nodeOutgoingEdges) {
          if (!executedNodes.has(edge.target)) {
            currentNodeIds.push(edge.target);
          }
        }
        continue;
      }
      
      const rawNodeData = {
        ...(node.data?.config || {}),
        nodeId: node.id,
      };
      // Resolve any forEach sentinels in the node data
      const nodeData = resolveForEachAddresses(rawNodeData, context);
      const nodeNotes =
        node.data && typeof node.data === 'object'
          ? ((node.data as any)?.config?.notes as string | undefined)
          : undefined;
      
      // Notify: node starting
      onProgress?.({
        type: 'node_start',
        nodeId: node.id,
        nodeType: node.type,
        data: restartCount > 1 ? { iteration: restartCount } : undefined,
      });

      // Persist a per-node log row early so failures are debuggable
      const logId = executionId
        ? await safeCreateExecutionLog({
            executionId,
            nodeId: node.id,
            nodeType: node.type,
            input: { ...(node.data?.config || {}), nodeId: node.id, iteration: restartCount },
          })
        : null;
      
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
        
        // Handle loop node - check if we should restart or continue
        if (node.type === 'loop' && result?.loopCount) {
          const loopCount = Math.min(3, Math.max(1, result.loopCount));
          const currentRestartCount = loopNodeRestartCounts.get(node.id) || 0;
          
          // If we haven't reached the loop count, restart from beginning
          if (currentRestartCount < loopCount) {
            loopNodeRestartCounts.set(node.id, currentRestartCount + 1);
            shouldRestart = true;
            
            allResults.push({
              nodeId: node.id,
              result: { ...result, iteration: restartCount, restarting: true },
            });
            
            // Notify: node completed with restart
            onProgress?.({
              type: 'node_complete',
              nodeId: node.id,
              nodeType: node.type,
              data: { ...result, iteration: restartCount, restarting: true },
            });

            await safeUpdateExecutionLog({
              logId,
              output: { result, iteration: restartCount, restarting: true },
            });
            
            // Break out of inner while loop to restart from start
            break;
          } else {
            // We've reached the loop count, continue past the loop node
            loopNodeRestartCounts.set(node.id, currentRestartCount);
            
            allResults.push({
              nodeId: node.id,
              result: { ...result, iteration: restartCount, restarting: false },
            });
            
            // Notify: node completed, continuing past loop
            onProgress?.({
              type: 'node_complete',
              nodeId: node.id,
              nodeType: node.type,
              data: { ...result, iteration: restartCount, restarting: false },
            });

            await safeUpdateExecutionLog({
              logId,
              output: { result, iteration: restartCount, restarting: false },
            });
            
            // Continue execution past the loop node
            const nodeOutgoingEdges = outgoingEdges.get(node.id) || [];
            for (const edge of nodeOutgoingEdges) {
              if (!executedNodes.has(edge.target)) {
                currentNodeIds.push(edge.target);
              }
            }
            continue;
          }
        }
        
        allResults.push({
          nodeId: node.id,
          result: { ...result, iteration: restartCount },
        });
        
        // Notify: node completed
        onProgress?.({
          type: 'node_complete',
          nodeId: node.id,
          nodeType: node.type,
          data: { ...result, iteration: restartCount },
        });

        await safeUpdateExecutionLog({
          logId,
          output: { result, iteration: restartCount },
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

        await safeUpdateExecutionLog({
          logId,
          error: parsed.technicalDetails,
          output: {
            userMessage: parsed.userMessage,
            errorType: parsed.errorType,
            isRetryable: parsed.isRetryable,
            code: parsed.code,
            shortMessage: parsed.shortMessage,
            revertReason: parsed.revertReason,
            txHash: parsed.txHash,
          },
        });
        
        // Notify: node error with user-friendly message
        onProgress?.({
          type: 'node_error',
          nodeId: node.id,
          nodeType: node.type,
          error: parsed.txHash ? `${parsed.userMessage} (tx: ${parsed.txHash})` : parsed.userMessage,
        });
        
        // If a node fails, stop execution with user-friendly message
        const txPart = parsed.txHash ? ` [tx: ${parsed.txHash}]` : '';
        const notesPart = nodeNotes ? ` "${nodeNotes}"` : '';
        throw new Error(
          `${node.type}${notesPart} (${node.id}) failed: ${parsed.userMessage}${txPart}${parsed.isRetryable ? ' (retryable)' : ''}`
        );
      }
    }
    
    // If we hit a loop node that triggered a restart, continue the outer loop
    // Otherwise, execution is complete
    if (!shouldRestart) {
      break;
    }
  }
  
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
