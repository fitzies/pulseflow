import { Contract, parseEther } from 'ethers';
import { erc20ABI } from './abis';
import { getProvider } from './blockchain-functions';
import { prisma } from './prisma';
import { getWalletFromEncryptedKey } from './wallet-generation';

/**
 * Variable reference types for amount fields
 */
export type AmountValue =
  | { type: 'static'; value: string } // User-entered value
  | { type: 'previousOutput'; field: string; percentage: number } // Use output from previous node
  | { type: 'currentBalance'; token: string; percentage: number }; // Use current wallet balance

/**
 * Execution context that tracks outputs from executed nodes
 */
export interface ExecutionContext {
  nodeOutputs: Map<string, Record<string, any>>; // nodeId -> output
  previousNodeId: string | null;
  previousNodeType: string | null;
}

/**
 * Create a new execution context
 */
export function createExecutionContext(): ExecutionContext {
  return {
    nodeOutputs: new Map(),
    previousNodeId: null,
    previousNodeType: null,
  };
}

/**
 * Resolve an amount value to a bigint
 */
export async function resolveAmount(
  amountConfig: AmountValue | string | undefined,
  context: ExecutionContext,
  automationId: string
): Promise<bigint> {
  // Handle legacy string values (backward compatibility)
  if (typeof amountConfig === 'string') {
    return BigInt(amountConfig || '0');
  }

  // Handle undefined/null
  if (!amountConfig) {
    return BigInt(0);
  }

  // Handle static values
  if (amountConfig.type === 'static') {
    const value = amountConfig.value || '0';
    // Convert human-readable amount (e.g., "1.5") to wei
    try {
      return parseEther(value);
    } catch {
      // If parseEther fails, try parsing as bigint directly (for legacy wei values)
      return BigInt(value || '0');
    }
  }

  // Handle previous output
  if (amountConfig.type === 'previousOutput') {
    if (!context.previousNodeId) {
      throw new Error('No previous node output available');
    }

    const previousOutput = context.nodeOutputs.get(context.previousNodeId);
    if (!previousOutput) {
      throw new Error(`Previous node ${context.previousNodeId} has no output`);
    }

    const fieldValue = previousOutput[amountConfig.field];
    if (fieldValue === undefined || fieldValue === null) {
      throw new Error(
        `Previous node output does not have field: ${amountConfig.field}`
      );
    }

    // Convert to bigint and apply percentage
    const value = typeof fieldValue === 'bigint' ? fieldValue : BigInt(fieldValue.toString());
    const percentage = amountConfig.percentage / 100;
    return (value * BigInt(Math.floor(percentage * 10000))) / 10000n;
  }

  // Handle current balance
  if (amountConfig.type === 'currentBalance') {
    // Get wallet from automation
    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
    });

    if (!automation) {
      throw new Error(`Automation ${automationId} not found`);
    }

    const wallet = await getWalletFromEncryptedKey(automation.walletEncKey);
    const provider = getProvider();

    let balance: bigint;

    // Empty token means PLS, but we don't allow empty for non-PLS nodes
    // (PLS operations have separate nodes)
    if (!amountConfig.token || amountConfig.token === '') {
      throw new Error('Token address is required for wallet balance (use separate PLS nodes for PLS operations)');
    }
    
    const tokenContract = new Contract(amountConfig.token, erc20ABI, provider);
    balance = await tokenContract.balanceOf(wallet.address);

    // Apply percentage
    const percentage = amountConfig.percentage / 100;
    return (balance * BigInt(Math.floor(percentage * 10000))) / 10000n;
  }

  throw new Error(`Unknown amount config type: ${(amountConfig as any).type}`);
}

/**
 * Extract output from a node execution result
 */
export function extractNodeOutput(
  nodeType: string,
  nodeId: string,
  result: any
): Record<string, any> | null {
  // Handle transaction receipts - extract from logs/events
  if (result && typeof result === 'object' && 'logs' in result) {
    // For swaps, we need to parse the amounts array from events
    // This is a simplified version - actual implementation may need to parse events
    return null; // Will be handled by parsing transaction logs
  }

  // Handle direct return values (like checkBalance, checkLPTokenAmounts)
  if (result && typeof result === 'object') {
    return result;
  }

  return null;
}

/**
 * Update context with node output
 */
export function updateContextWithOutput(
  context: ExecutionContext,
  nodeId: string,
  nodeType: string,
  output: Record<string, any> | null
): ExecutionContext {
  const newContext = {
    ...context,
    previousNodeId: nodeId,
    previousNodeType: nodeType,
  };

  if (output) {
    newContext.nodeOutputs.set(nodeId, output);
  }

  return newContext;
}

/**
 * Parse swap transaction receipt to extract amountOut
 */
export async function parseSwapOutput(
  receipt: any,
  path: string[]
): Promise<{ amountOut: bigint; tokenOut: string } | null> {
  if (!receipt || !receipt.logs || !path || path.length === 0) {
    return null;
  }

  try {
    // The last token in the path is the output token
    const tokenOut = path[path.length - 1];

    // Parse Swap event from PulseX router
    // Event: Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)
    // We need to find the Swap event and extract amountOut
    // This is a simplified version - actual implementation should parse the event properly
    
    // For now, we'll need to query the balance change or parse events
    // This is a placeholder - you may need to implement proper event parsing
    return null;
  } catch (error) {
    console.error('Error parsing swap output:', error);
    return null;
  }
}
