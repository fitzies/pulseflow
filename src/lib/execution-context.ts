import { Contract, parseEther } from 'ethers';
import { erc20ABI, pairABI, pulsexRouterABI, PulseXRouter, WPLS } from './abis';
import { getProvider } from './blockchain-functions';
import { prisma } from './prisma';
import { getWalletFromEncryptedKey } from './wallet-generation';

/**
 * Variable reference types for amount fields
 */
export type AmountValue =
  | { type: 'static'; value: string } // User-entered value
  | { type: 'previousOutput'; field: string; percentage: number } // Use output from previous node
  | { type: 'currentBalance'; token: string; percentage: number } // Use current wallet balance
  | { type: 'lpRatio'; baseToken: string; baseAmountField: string; pairedToken: string }; // Auto-calculate from LP ratio (field reference)

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

  // Handle current balance (legacy - no longer used in UI but kept for backward compatibility)
  if (amountConfig.type === 'currentBalance') {
    throw new Error('Wallet balance option has been removed. Use "Custom Amount" or "Previous Output" instead.');
  }

  // Handle LP ratio calculation - requires nodeData context
  if (amountConfig.type === 'lpRatio') {
    throw new Error('lpRatio type requires nodeData context - use resolveLpRatioAmount instead');
  }

  throw new Error(`Unknown amount config type: ${(amountConfig as any).type}`);
}

/**
 * Resolve an amount value that may be lpRatio type (requires nodeData context)
 */
export async function resolveAmountWithNodeData(
  amountConfig: AmountValue | string | undefined,
  nodeData: Record<string, any>,
  context: ExecutionContext,
  automationId: string
): Promise<bigint> {
  // Handle non-lpRatio types with standard resolver
  if (!amountConfig || typeof amountConfig === 'string') {
    return resolveAmount(amountConfig, context, automationId);
  }

  if (amountConfig.type !== 'lpRatio') {
    return resolveAmount(amountConfig, context, automationId);
  }

  // Handle LP ratio calculation with nodeData context
  const provider = getProvider();

  // Resolve the base amount from the referenced field in nodeData
  const baseAmountConfig = nodeData[amountConfig.baseAmountField];
  if (!baseAmountConfig) {
    throw new Error(`LP ratio base amount field '${amountConfig.baseAmountField}' not found in nodeData`);
  }

  // Recursively resolve (but baseAmountConfig shouldn't be lpRatio to avoid circular)
  const baseAmount = await resolveAmountWithNodeData(baseAmountConfig, nodeData, context, automationId);
  if (baseAmount === 0n) {
    return 0n;
  }

  // Determine token addresses
  const baseToken = amountConfig.baseToken;
  const pairedToken = amountConfig.pairedToken === 'PLS' ? WPLS : amountConfig.pairedToken;

  if (!baseToken || !pairedToken) {
    throw new Error('LP ratio calculation requires both tokens to be specified');
  }

  try {
    // Get pair address from factory
    const routerContract = new Contract(PulseXRouter, pulsexRouterABI, provider);
    const factoryAddress = await routerContract.factory();
    const factoryContract = new Contract(factoryAddress, [
      "function getPair(address tokenA, address tokenB) external view returns (address pair)",
    ], provider);

    const pairAddress = await factoryContract.getPair(baseToken, pairedToken);
    if (!pairAddress || pairAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error('No LP exists between the specified tokens');
    }

    // Get reserves from pair
    const pairContract = new Contract(pairAddress, pairABI, provider);
    const reserves = await pairContract.getReserves();
    const token0 = await pairContract.token0();

    // Determine which reserve is which
    const isBaseToken0 = token0.toLowerCase() === baseToken.toLowerCase();
    const reserveBase = isBaseToken0 ? reserves[0] : reserves[1];
    const reservePaired = isBaseToken0 ? reserves[1] : reserves[0];

    // Use quote to calculate the paired amount
    // quote(inputAmount, inputReserve, outputReserve) = outputAmount
    // We know the pairedToken amount (baseAmount), we want the baseToken amount
    const pairedAmount = await routerContract.quote(baseAmount, reservePaired, reserveBase);

    return pairedAmount;
  } catch (error) {
    console.error('Error calculating LP ratio amount:', error);
    throw new Error(`Failed to calculate amount from LP ratio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
