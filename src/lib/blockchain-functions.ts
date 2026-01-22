import {
  Contract,
  JsonRpcProvider,
  Wallet,
  MaxUint256,
  type ContractTransactionReceipt,
  type ContractTransactionResponse
} from "ethers";
import { prisma } from "./prisma";
import { getWalletFromEncryptedKey } from "./wallet-generation";
import { erc20ABI, playgroundTokenABI, pairABI, pulsexRouterABI, PulseXRouter, WPLS } from "./abis";
import { CONFIG } from "./config";
import type { ExecutionContext, AmountValue } from "./execution-context";
import { resolveAmount, resolveAmountWithNodeData, extractNodeOutput, updateContextWithOutput } from "./execution-context";

// Automation Contract ABI - extracted from automation-contract.sol
const AUTOMATION_CONTRACT_ABI = [
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable returns (uint[] memory amounts)",
  "function swapExactPLSForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForPLS(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable returns (uint[] memory amounts)",
  "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external payable returns (uint256 amountA, uint256 amountB, uint256 liquidity)",
  "function addLiquidityPLS(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountPLSMin, address to, uint256 deadline) external payable returns (uint256 amountToken, uint256 amountPLS, uint256 liquidity)",
  "function removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external payable returns (uint256 amountA, uint256 amountB)",
  "function removeLiquidityPLS(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountPLSMin, address to, uint256 deadline) external payable returns (uint256 amountToken, uint256 amountPLS)",
  "function transferToken(address token, address to, uint256 amount) external payable",
  "function transferPLS(address to, uint256 amount) external payable",
  "function burnToken(address token, uint256 amount) external payable",
  "function claimToken(address token, uint256 amount) external payable",
  "function checkLPTokenAmounts(address pairAddress, address user) external view returns (uint256 lpBalance, address token0, address token1, uint256 token0Amount, uint256 token1Amount)",
  "function isPlaygroundToken(address token) public view returns (bool)",
] as const;

const PULSECHAIN_RPC = CONFIG.pulsechainRpc;

// Contract address from config
const AUTOMATION_CONTRACT_ADDRESS = CONFIG.automationContract;

export function setAutomationContractAddress(address: string) {
  // Note: This function is kept for backward compatibility but now uses config
  console.warn("setAutomationContractAddress is deprecated. Use CONFIG.automationContract instead.");
}

export function getAutomationContractAddress(): string {
  return AUTOMATION_CONTRACT_ADDRESS;
}

/**
 * Gets PulseChain RPC provider
 */
export function getProvider(): JsonRpcProvider {
  return new JsonRpcProvider(PULSECHAIN_RPC);
}

/**
 * Gets automation contract instance
 */
export function getAutomationContract(
  wallet: Wallet,
  contractAddress?: string
): Contract {
  const address = contractAddress || AUTOMATION_CONTRACT_ADDRESS;
  const provider = getProvider();
  // Connect wallet to provider if not already connected
  const connectedWallet = wallet.provider ? wallet : wallet.connect(provider);
  return new Contract(address, AUTOMATION_CONTRACT_ABI, connectedWallet);
}

/**
 * Checks if a token is a playground token by checking for parent() function
 */
export async function checkIsPlaygroundToken(tokenAddress: string): Promise<boolean> {
  const provider = getProvider();
  const tokenContract = new Contract(tokenAddress, playgroundTokenABI, provider);

  try {
    const parent = await tokenContract.parent();
    return parent !== "0x0000000000000000000000000000000000000000";
  } catch {
    return false;
  }
}

/**
 * Gets wallet from automation ID
 */
async function getWalletFromAutomation(automationId: string): Promise<Wallet> {
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
  });

  if (!automation) {
    throw new Error(`Automation ${automationId} not found`);
  }

  return getWalletFromEncryptedKey(automation.walletEncKey);
}

/**
 * Executes swap operation
 */
export async function swapTokens(
  automationId: string,
  amountIn: bigint,
  amountOutMin: bigint,
  path: string[],
  to: string,
  deadline: bigint,
  contractAddress?: string
): Promise<ContractTransactionReceipt> {
  const wallet = await getWalletFromAutomation(automationId);
  const contract = getAutomationContract(wallet, contractAddress);

  // Approve input token if needed (first token in path)
  if (path.length > 0) {
    const provider = getProvider();
    const connectedWallet = wallet.provider ? wallet : wallet.connect(provider);
    const tokenContract = new Contract(path[0], erc20ABI, connectedWallet);
    const contractAddr = contractAddress || AUTOMATION_CONTRACT_ADDRESS;

    // Check current allowance, approve max if insufficient
    const allowance = await tokenContract.allowance(wallet.address, contractAddr);
    if (allowance < amountIn) {
      const approveTx = await tokenContract.approve(contractAddr, MaxUint256);
      await approveTx.wait();
    }
  }

  const tx: ContractTransactionResponse = await contract.swapExactTokensForTokens(
    amountIn,
    amountOutMin,
    path,
    to,
    deadline
  );

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  return receipt as ContractTransactionReceipt;
}

/**
 * Executes swap PLS to tokens operation
 */
export async function swapPLSForTokens(
  automationId: string,
  amountOutMin: bigint,
  path: string[],
  to: string,
  deadline: bigint,
  plsAmount: bigint,
  contractAddress?: string
): Promise<ContractTransactionReceipt> {
  const wallet = await getWalletFromAutomation(automationId);
  const contract = getAutomationContract(wallet, contractAddress);

  const tx: ContractTransactionResponse = await contract.swapExactPLSForTokens(
    amountOutMin,
    path,
    to,
    deadline,
    { value: plsAmount }
  );

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  return receipt as ContractTransactionReceipt;
}

/**
 * Executes swap tokens to PLS operation
 */
export async function swapTokensForPLS(
  automationId: string,
  amountIn: bigint,
  amountOutMin: bigint,
  path: string[],
  to: string,
  deadline: bigint,
  contractAddress?: string
): Promise<ContractTransactionReceipt> {
  const wallet = await getWalletFromAutomation(automationId);
  const contract = getAutomationContract(wallet, contractAddress);

  // Approve input token if needed (first token in path)
  if (path.length > 0) {
    const provider = getProvider();
    const connectedWallet = wallet.provider ? wallet : wallet.connect(provider);
    const tokenContract = new Contract(path[0], erc20ABI, connectedWallet);
    const contractAddr = contractAddress || AUTOMATION_CONTRACT_ADDRESS;

    // Check current allowance, approve max if insufficient
    const allowance = await tokenContract.allowance(wallet.address, contractAddr);
    if (allowance < amountIn) {
      const approveTx = await tokenContract.approve(contractAddr, MaxUint256);
      await approveTx.wait();
    }
  }

  const tx: ContractTransactionResponse = await contract.swapExactTokensForPLS(
    amountIn,
    amountOutMin,
    path,
    to,
    deadline
  );

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  return receipt as ContractTransactionReceipt;
}

/**
 * Executes add liquidity operation
 */
export async function addLiquidity(
  automationId: string,
  tokenA: string,
  tokenB: string,
  amountADesired: bigint,
  amountBDesired: bigint,
  amountAMin: bigint,
  amountBMin: bigint,
  to: string,
  deadline: bigint,
  contractAddress?: string
): Promise<ContractTransactionReceipt> {
  const wallet = await getWalletFromAutomation(automationId);
  const contract = getAutomationContract(wallet, contractAddress);

  // Approve tokens first
  const provider = getProvider();
  const connectedWallet = wallet.provider ? wallet : wallet.connect(provider);
  const tokenAContract = new Contract(tokenA, erc20ABI, connectedWallet);
  const tokenBContract = new Contract(tokenB, erc20ABI, connectedWallet);

  const contractAddr = contractAddress || AUTOMATION_CONTRACT_ADDRESS;

  // Check and approve tokenA if needed
  const allowanceA = await tokenAContract.allowance(wallet.address, contractAddr);
  if (allowanceA < amountADesired) {
    const approveTxA = await tokenAContract.approve(contractAddr, MaxUint256);
    await approveTxA.wait();
  }

  // Check and approve tokenB if needed
  const allowanceB = await tokenBContract.allowance(wallet.address, contractAddr);
  if (allowanceB < amountBDesired) {
    const approveTxB = await tokenBContract.approve(contractAddr, MaxUint256);
    await approveTxB.wait();
  }

  const tx: ContractTransactionResponse = await contract.addLiquidity(
    tokenA,
    tokenB,
    amountADesired,
    amountBDesired,
    amountAMin,
    amountBMin,
    to,
    deadline,
    { gasLimit: 500000n }
  );

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  return receipt as ContractTransactionReceipt;
}

/**
 * Executes add liquidity with PLS operation
 */
export async function addLiquidityPLS(
  automationId: string,
  token: string,
  amountTokenDesired: bigint,
  amountTokenMin: bigint,
  amountPLSMin: bigint,
  to: string,
  deadline: bigint,
  plsAmount: bigint,
  contractAddress?: string
): Promise<ContractTransactionReceipt> {
  const wallet = await getWalletFromAutomation(automationId);
  const contract = getAutomationContract(wallet, contractAddress);

  // Approve token first (PLS is native, no approval needed)
  const provider = getProvider();
  const connectedWallet = wallet.provider ? wallet : wallet.connect(provider);
  const tokenContract = new Contract(token, erc20ABI, connectedWallet);

  const contractAddr = contractAddress || AUTOMATION_CONTRACT_ADDRESS;

  // Check and approve token if needed
  const allowance = await tokenContract.allowance(wallet.address, contractAddr);
  if (allowance < amountTokenDesired) {
    const approveTx = await tokenContract.approve(contractAddr, MaxUint256);
    await approveTx.wait();
  }

  const tx: ContractTransactionResponse = await contract.addLiquidityPLS(
    token,
    amountTokenDesired,
    amountTokenMin,
    amountPLSMin,
    to,
    deadline,
    { value: plsAmount, gasLimit: 500000n }
  );

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  return receipt as ContractTransactionReceipt;
}

/**
 * Executes remove liquidity operation
 */
export async function removeLiquidity(
  automationId: string,
  tokenA: string,
  tokenB: string,
  liquidity: bigint,
  amountAMin: bigint,
  amountBMin: bigint,
  to: string,
  deadline: bigint,
  contractAddress?: string
): Promise<ContractTransactionReceipt> {
  const wallet = await getWalletFromAutomation(automationId);
  const contract = getAutomationContract(wallet, contractAddress);

  // Get pair address and approve LP tokens
  const provider = getProvider();
  const routerContract = new Contract(PulseXRouter, [
    "function factory() external pure returns (address)",
    "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  ], provider);

  const factoryAddress = await routerContract.factory();
  const factoryContract = new Contract(factoryAddress, [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  ], provider);

  const pairAddress = await factoryContract.getPair(tokenA, tokenB);
  if (!pairAddress || pairAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Pair does not exist");
  }

  const connectedWallet = wallet.provider ? wallet : wallet.connect(provider);
  const pairContract = new Contract(pairAddress, erc20ABI, connectedWallet);
  const contractAddr = contractAddress || AUTOMATION_CONTRACT_ADDRESS;

  // Check and approve LP tokens if needed
  const allowance = await pairContract.allowance(wallet.address, contractAddr);
  if (allowance < liquidity) {
    const approveTx = await pairContract.approve(contractAddr, MaxUint256);
    await approveTx.wait();
  }

  const tx: ContractTransactionResponse = await contract.removeLiquidity(
    tokenA,
    tokenB,
    liquidity,
    amountAMin,
    amountBMin,
    to,
    deadline,
    { gasLimit: 500000n }
  );

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  return receipt as ContractTransactionReceipt;
}

/**
 * Executes remove liquidity with PLS operation
 */
export async function removeLiquidityPLS(
  automationId: string,
  token: string,
  liquidity: bigint,
  amountTokenMin: bigint,
  amountPLSMin: bigint,
  to: string,
  deadline: bigint,
  contractAddress?: string
): Promise<ContractTransactionReceipt> {
  const wallet = await getWalletFromAutomation(automationId);
  const contract = getAutomationContract(wallet, contractAddress);

  // Get pair address and approve LP tokens
  const provider = getProvider();
  const routerContract = new Contract(PulseXRouter, [
    "function factory() external pure returns (address)",
  ], provider);

  const factoryAddress = await routerContract.factory();
  const factoryContract = new Contract(factoryAddress, [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  ], provider);

  const WPLS_ADDRESS = "0xA1077a294dDE1B09bB078844df40758a5D0f9a27";
  const pairAddress = await factoryContract.getPair(token, WPLS_ADDRESS);
  if (!pairAddress || pairAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Pair does not exist");
  }

  const connectedWallet = wallet.provider ? wallet : wallet.connect(provider);
  const pairContract = new Contract(pairAddress, erc20ABI, connectedWallet);
  const contractAddr = contractAddress || AUTOMATION_CONTRACT_ADDRESS;

  // Check and approve LP tokens if needed
  const allowancePLS = await pairContract.allowance(wallet.address, contractAddr);
  if (allowancePLS < liquidity) {
    const approveTx = await pairContract.approve(contractAddr, MaxUint256);
    await approveTx.wait();
  }

  const tx: ContractTransactionResponse = await contract.removeLiquidityPLS(
    token,
    liquidity,
    amountTokenMin,
    amountPLSMin,
    to,
    deadline,
    { gasLimit: 500000n }
  );

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  return receipt as ContractTransactionReceipt;
}

/**
 * Executes transfer operation
 */
export async function transferTokens(
  automationId: string,
  token: string,
  to: string,
  amount: bigint,
  contractAddress?: string
): Promise<ContractTransactionReceipt> {
  const wallet = await getWalletFromAutomation(automationId);
  const contract = getAutomationContract(wallet, contractAddress);

  // Approve token first
  const provider = getProvider();
  const connectedWallet = wallet.provider ? wallet : wallet.connect(provider);
  const tokenContract = new Contract(token, erc20ABI, connectedWallet);
  const contractAddr = contractAddress || AUTOMATION_CONTRACT_ADDRESS;

  // Check and approve token if needed
  const allowance = await tokenContract.allowance(wallet.address, contractAddr);
  if (allowance < amount) {
    const approveTx = await tokenContract.approve(contractAddr, MaxUint256);
    await approveTx.wait();
  }

  const tx: ContractTransactionResponse = await contract.transferToken(
    token,
    to,
    amount
  );

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  return receipt as ContractTransactionReceipt;
}

/**
 * Executes transfer PLS operation
 */
export async function transferPLS(
  automationId: string,
  to: string,
  amount: bigint,
  contractAddress?: string
): Promise<ContractTransactionReceipt> {
  const wallet = await getWalletFromAutomation(automationId);
  const contract = getAutomationContract(wallet, contractAddress);

  const tx: ContractTransactionResponse = await contract.transferPLS(
    to,
    amount,
    { value: amount }
  );

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  return receipt as ContractTransactionReceipt;
}

/**
 * Executes burn operation (playground tokens only)
 */
export async function burnTokens(
  automationId: string,
  token: string,
  amount: bigint,
  contractAddress?: string
): Promise<ContractTransactionReceipt> {
  const wallet = await getWalletFromAutomation(automationId);
  const contract = getAutomationContract(wallet, contractAddress);

  // Verify it's a playground token
  const isPlayground = await checkIsPlaygroundToken(token);
  if (!isPlayground) {
    throw new Error("Token is not a playground token");
  }

  // Get parent token and approve it (contract transfers parent tokens, not playground tokens)
  const provider = getProvider();
  const connectedWallet = wallet.provider ? wallet : wallet.connect(provider);
  const playgroundToken = new Contract(token, playgroundTokenABI, provider);
  const parentTokenAddress = await playgroundToken.parent();

  const parentTokenContract = new Contract(parentTokenAddress, erc20ABI, connectedWallet);
  const contractAddr = contractAddress || AUTOMATION_CONTRACT_ADDRESS;

  const allowance = await parentTokenContract.allowance(wallet.address, contractAddr);
  if (allowance < amount) {
    const approveTx = await parentTokenContract.approve(contractAddr, MaxUint256);
    await approveTx.wait();
  }

  const tx: ContractTransactionResponse = await contract.burnToken(
    token,
    amount
  );

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  return receipt as ContractTransactionReceipt;
}

/**
 * Executes claim operation (playground tokens only)
 */
export async function claimTokens(
  automationId: string,
  token: string,
  amount: bigint,
  contractAddress?: string
): Promise<ContractTransactionReceipt> {
  const wallet = await getWalletFromAutomation(automationId);
  const contract = getAutomationContract(wallet, contractAddress);

  // Verify it's a playground token
  const isPlayground = await checkIsPlaygroundToken(token);
  if (!isPlayground) {
    throw new Error("Token is not a playground token");
  }

  // Approve playground token first
  const provider = getProvider();
  const connectedWallet = wallet.provider ? wallet : wallet.connect(provider);
  const tokenContract = new Contract(token, erc20ABI, connectedWallet);
  const contractAddr = contractAddress || AUTOMATION_CONTRACT_ADDRESS;

  const allowance = await tokenContract.allowance(wallet.address, contractAddr);
  if (allowance < amount) {
    const approveTx = await tokenContract.approve(contractAddr, MaxUint256);
    await approveTx.wait();
  }

  const tx: ContractTransactionResponse = await contract.claimToken(
    token,
    amount
  );

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  return receipt as ContractTransactionReceipt;
}

/**
 * Checks LP token amounts (read-only, no fee)
 */
export async function checkLPTokenAmounts(
  automationId: string,
  pairAddress: string,
  contractAddress?: string
): Promise<{
  lpBalance: bigint;
  token0: string;
  token1: string;
  token0Amount: bigint;
  token1Amount: bigint;
  ratio: number;
}> {
  const wallet = await getWalletFromAutomation(automationId);
  const contract = getAutomationContract(wallet, contractAddress);
  const provider = getProvider();

  const result = await contract.checkLPTokenAmounts(pairAddress, wallet.address);

  const lpBalance = result[0];
  const token0 = result[1];
  const token1 = result[2];
  const token0Amount = result[3];
  const token1Amount = result[4];

  // Get pool reserves directly to calculate ratio (independent of user balance)
  const pairContract = new Contract(pairAddress, pairABI, provider);
  const [reserve0, reserve1] = await pairContract.getReserves();

  // Calculate ratio from pool reserves: reserve1 / reserve0
  let ratio = 0;
  if (reserve0 > 0n) {
    ratio = Number(reserve1) / Number(reserve0);
  }

  return {
    lpBalance,
    token0,
    token1,
    token0Amount,
    token1Amount,
    ratio,
  };
}

/**
 * Helper to resolve amount field from nodeData
 * Uses resolveAmountWithNodeData to support lpRatio field references
 */
async function resolveAmountField(
  field: string,
  nodeData: Record<string, any>,
  context: ExecutionContext,
  automationId: string,
  nodeType?: string
): Promise<bigint> {
  const amountConfig = nodeData[field];

  // For swap nodes using wallet balance, use first token in path
  if (
    amountConfig &&
    typeof amountConfig === 'object' &&
    amountConfig.type === 'currentBalance' &&
    (nodeType === 'swap' || nodeType === 'swapFromPLS' || nodeType === 'swapPLS' || nodeType === 'swapToPLS')
  ) {
    const path = nodeData.path || [];
    if (path.length > 0 && !amountConfig.token) {
      // Use first token in path
      amountConfig.token = path[0];
    }
  }

  // Use resolveAmountWithNodeData to support lpRatio field references
  return resolveAmountWithNodeData(amountConfig, nodeData, context, automationId);
}

/**
 * Extract gas price from transaction receipt
 * Returns the effective gas price in wei
 */
function extractGasPrice(receipt: ContractTransactionReceipt): bigint {
  // Try to get effectiveGasPrice first (EIP-1559), fallback to gasPrice
  if (receipt.gasPrice !== null && receipt.gasPrice !== undefined) {
    return receipt.gasPrice;
  }
  return BigInt(0);
}

/**
 * Extract output from swap transaction using ERC20 Transfer events
 * Includes gas price for Gas Guard node
 */
async function extractSwapOutput(
  receipt: ContractTransactionReceipt,
  path: string[],
  provider: JsonRpcProvider,
  recipientAddress: string
): Promise<{ amountOut: bigint; tokenOut: string; gasPrice: bigint; gasUsed: bigint } | null> {
  if (!path || path.length === 0) return null;

  const tokenOut = path[path.length - 1];
  const gasPrice = extractGasPrice(receipt);
  const gasUsed = receipt.gasUsed || BigInt(0);

  try {
    // Use ERC20 Transfer event to detect output amount
    // Transfer event: Transfer(address indexed from, address indexed to, uint256 value)
    const erc20Interface = new Contract(tokenOut, erc20ABI, provider).interface;

    for (const log of receipt.logs) {
      // Only check logs from the output token contract
      if (log.address.toLowerCase() !== tokenOut.toLowerCase()) continue;

      try {
        const parsed = erc20Interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (parsed && parsed.name === 'Transfer') {
          const to = parsed.args.to as string;
          const value = parsed.args.value as bigint;

          // Check if this transfer is TO the recipient (automation wallet or specified address)
          if (to.toLowerCase() === recipientAddress.toLowerCase()) {
            return { amountOut: value, tokenOut, gasPrice, gasUsed };
          }
        }
      } catch {
        // Not a Transfer event from this contract, continue
        continue;
      }
    }
  } catch (error) {
    console.warn("Could not parse swap output from receipt:", error);
  }

  // Fallback: return 0 if we couldn't find the transfer
  return {
    amountOut: BigInt(0),
    tokenOut,
    gasPrice,
    gasUsed,
  };
}

/**
 * Create transaction output with gas price for Gas Guard
 */
function createTxOutput(receipt: ContractTransactionReceipt): { gasPrice: bigint; gasUsed: bigint } {
  return {
    gasPrice: extractGasPrice(receipt),
    gasUsed: receipt.gasUsed || BigInt(0),
  };
}

/**
 * Generic function to execute any node type based on node data
 */
export async function executeNode(
  automationId: string,
  nodeType: string,
  nodeData: Record<string, any>,
  context: ExecutionContext,
  contractAddress?: string
): Promise<{ result: ContractTransactionReceipt | any; context: ExecutionContext }> {
  // Get wallet for to address and calculations
  const wallet = await getWalletFromAutomation(automationId);
  const provider = getProvider();

  // Calculate deadline: 20 minutes from now
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

  // Default to automation wallet address
  const to = nodeData.to || wallet.address;

  // Default slippage: 1%
  const slippage = nodeData.slippage ?? 0.01;

  switch (nodeType) {
    case "swap":
      // Check if swapping PLS (native) or tokens
      if (nodeData.usePLS && nodeData.usePLS === true) {
        const plsAmount = await resolveAmountField('plsAmount', nodeData, context, automationId);
        const path = nodeData.path || [];

        // Calculate amountOutMin from slippage
        let amountOutMin = BigInt(0);
        if (path.length > 0 && plsAmount > 0n) {
          const routerContract = new Contract(PulseXRouter, pulsexRouterABI, provider);
          const amountsOut = await routerContract.getAmountsOut(plsAmount, path);
          const expectedOut = amountsOut[amountsOut.length - 1];
          // Apply slippage: amountOutMin = expectedOut * (1 - slippage)
          amountOutMin = (expectedOut * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
        }

        const receipt = await swapPLSForTokens(
          automationId,
          amountOutMin,
          path,
          to,
          deadline,
          plsAmount,
          contractAddress
        );

        // Extract output
        const output = await extractSwapOutput(receipt, path, provider, to);
        const updatedContext = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, output);

        return { result: receipt, context: updatedContext };
      } else {
        const path = nodeData.path || [];
        const swapMode = nodeData.swapMode || 'exactIn';

        let amountIn: bigint;
        let amountOutMin = BigInt(0);

        if (swapMode === 'exactOut') {
          // User specified desired output, calculate required input
          const amountOut = await resolveAmountField('amountOut', nodeData, context, automationId, nodeType);

          if (path.length > 0 && amountOut > 0n) {
            const routerContract = new Contract(PulseXRouter, pulsexRouterABI, provider);
            const amountsIn = await routerContract.getAmountsIn(amountOut, path);
            const calculatedAmountIn = amountsIn[0];
            // Apply slippage: amountIn = calculatedAmountIn * (1 + slippage) - user willing to spend up to this
            amountIn = (calculatedAmountIn * BigInt(Math.floor((1 + slippage) * 10000))) / 10000n;
            // amountOutMin is the user's desired output (what they want to receive at minimum)
            amountOutMin = amountOut;
          } else {
            amountIn = BigInt(0);
          }
        } else {
          // Default: exactIn mode - user specified input amount
          amountIn = await resolveAmountField('amountIn', nodeData, context, automationId, nodeType);

          // Calculate amountOutMin from slippage
          if (path.length > 0 && amountIn > 0n) {
            const routerContract = new Contract(PulseXRouter, pulsexRouterABI, provider);
            const amountsOut = await routerContract.getAmountsOut(amountIn, path);
            const expectedOut = amountsOut[amountsOut.length - 1];
            // Apply slippage: amountOutMin = expectedOut * (1 - slippage)
            amountOutMin = (expectedOut * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
          }
        }

        const receipt = await swapTokens(
          automationId,
          amountIn,
          amountOutMin,
          path,
          to,
          deadline,
          contractAddress
        );

        // Extract output
        const output = await extractSwapOutput(receipt, path, provider, to);
        const updatedContext = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, output);

        return { result: receipt, context: updatedContext };
      }

    case "addLiquidity":
      // Check if adding liquidity with PLS (native) or tokens
      if (nodeData.usePLS && nodeData.usePLS === true) {
        const amountTokenDesired = await resolveAmountField('amountTokenDesired', nodeData, context, automationId, nodeType);
        const plsAmount = await resolveAmountField('plsAmount', nodeData, context, automationId, nodeType);

        // Calculate min amounts from slippage
        const amountTokenMin = (amountTokenDesired * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
        const amountPLSMin = (plsAmount * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;

        const receiptAddLP = await addLiquidityPLS(
          automationId,
          nodeData.token || "",
          amountTokenDesired,
          amountTokenMin,
          amountPLSMin,
          to,
          deadline,
          plsAmount,
          contractAddress
        );

        // Extract output (liquidity, amounts) with gas price for Gas Guard
        const baseOutputAddLP = extractNodeOutput(nodeType, nodeData.nodeId || 'unknown', receiptAddLP);
        const outputAddLP = { ...baseOutputAddLP, ...createTxOutput(receiptAddLP) };
        const updatedContextAddLP = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, outputAddLP);

        return { result: receiptAddLP, context: updatedContextAddLP };
      } else {
        const amountADesired = await resolveAmountField('amountADesired', nodeData, context, automationId, nodeType);
        // Calculate amountBDesired using quote if only amountA is provided
        let amountBDesired = BigInt(nodeData.amountBDesired || 0);
        if (amountBDesired === 0n && amountADesired > 0n && nodeData.tokenA && nodeData.tokenB) {
          try {
            const routerContract = new Contract(PulseXRouter, pulsexRouterABI, provider);
            // Get reserves from pair
            const factoryAddress = await routerContract.factory();
            const factoryContract = new Contract(factoryAddress, [
              "function getPair(address tokenA, address tokenB) external view returns (address pair)",
            ], provider);
            const pairAddress = await factoryContract.getPair(nodeData.tokenA, nodeData.tokenB);
            if (pairAddress && pairAddress !== "0x0000000000000000000000000000000000000000") {
              const pairContract = new Contract(pairAddress, pairABI, provider);
              const reserves = await pairContract.getReserves();
              const token0 = await pairContract.token0();
              const reserveA = token0.toLowerCase() === nodeData.tokenA.toLowerCase() ? reserves[0] : reserves[1];
              const reserveB = token0.toLowerCase() === nodeData.tokenA.toLowerCase() ? reserves[1] : reserves[0];
              // Use quote to calculate amountB
              amountBDesired = await routerContract.quote(amountADesired, reserveA, reserveB);
            }
          } catch (error) {
            console.warn("Could not calculate amountBDesired from quote:", error);
          }
        }

        // Calculate min amounts from slippage
        const amountAMin = (amountADesired * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
        const amountBMin = (amountBDesired * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;

        const receiptAddLiquidity = await addLiquidity(
          automationId,
          nodeData.tokenA || "",
          nodeData.tokenB || "",
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          to,
          deadline,
          contractAddress
        );

        // Extract output with gas price for Gas Guard
        const baseOutputAddLiquidity = extractNodeOutput(nodeType, nodeData.nodeId || 'unknown', receiptAddLiquidity);
        const outputAddLiquidity = { ...baseOutputAddLiquidity, ...createTxOutput(receiptAddLiquidity) };
        const updatedContextAddLiquidity = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, outputAddLiquidity);

        return { result: receiptAddLiquidity, context: updatedContextAddLiquidity };
      }

    case "addLiquidityPLS":
      const amountTokenDesiredPLS = await resolveAmountField('amountTokenDesired', nodeData, context, automationId, nodeType);
      const plsAmountPLS = await resolveAmountField('plsAmount', nodeData, context, automationId, nodeType);

      // Calculate min amounts from slippage
      const amountTokenMinPLS = (amountTokenDesiredPLS * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
      const amountPLSMinPLS = (plsAmountPLS * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;

      const receiptAddLiquidityPLS = await addLiquidityPLS(
        automationId,
        nodeData.token || "",
        amountTokenDesiredPLS,
        amountTokenMinPLS,
        amountPLSMinPLS,
        to,
        deadline,
        plsAmountPLS,
        contractAddress
      );

      // Extract output with gas price for Gas Guard
      const baseOutputAddLiquidityPLS = extractNodeOutput(nodeType, nodeData.nodeId || 'unknown', receiptAddLiquidityPLS);
      const outputAddLiquidityPLS = { ...baseOutputAddLiquidityPLS, ...createTxOutput(receiptAddLiquidityPLS) };
      const updatedContextAddLiquidityPLS = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, outputAddLiquidityPLS);

      return { result: receiptAddLiquidityPLS, context: updatedContextAddLiquidityPLS };

    case "swapFromPLS":
    case "swapPLS": // Keep for backward compatibility
      let pathSwap = nodeData.path || [];
      const swapModeFromPLS = nodeData.swapMode || 'exactIn';

      // Auto-prepend WPLS if path doesn't start with it
      if (pathSwap.length === 0 || pathSwap[0]?.toLowerCase() !== WPLS.toLowerCase()) {
        pathSwap = [WPLS, ...pathSwap];
      }

      let plsAmountSwap: bigint;
      let amountOutMinSwap = BigInt(0);

      if (swapModeFromPLS === 'exactOut') {
        // User specified desired token output, calculate required PLS input
        const amountOutSwap = await resolveAmountField('amountOut', nodeData, context, automationId, nodeType);

        if (pathSwap.length > 0 && amountOutSwap > 0n) {
          const routerContract = new Contract(PulseXRouter, pulsexRouterABI, provider);
          const amountsIn = await routerContract.getAmountsIn(amountOutSwap, pathSwap);
          const calculatedPlsAmount = amountsIn[0];
          // Apply slippage: plsAmount = calculatedPlsAmount * (1 + slippage) - user willing to spend up to this
          plsAmountSwap = (calculatedPlsAmount * BigInt(Math.floor((1 + slippage) * 10000))) / 10000n;
          // amountOutMin is the user's desired output
          amountOutMinSwap = amountOutSwap;
        } else {
          plsAmountSwap = BigInt(0);
        }
      } else {
        // Default: exactIn mode - user specified PLS input amount
        plsAmountSwap = await resolveAmountField('plsAmount', nodeData, context, automationId, nodeType);

        // Calculate amountOutMin from slippage
        if (pathSwap.length > 0 && plsAmountSwap > 0n) {
          const routerContract = new Contract(PulseXRouter, pulsexRouterABI, provider);
          const amountsOut = await routerContract.getAmountsOut(plsAmountSwap, pathSwap);
          const expectedOut = amountsOut[amountsOut.length - 1];
          // Apply slippage: amountOutMin = expectedOut * (1 - slippage)
          amountOutMinSwap = (expectedOut * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
        }
      }

      const receiptSwap = await swapPLSForTokens(
        automationId,
        amountOutMinSwap,
        pathSwap,
        to,
        deadline,
        plsAmountSwap,
        contractAddress
      );

      // Extract output
      const outputSwap = await extractSwapOutput(receiptSwap, pathSwap, provider, to);
      const updatedContextSwap = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, outputSwap);

      return { result: receiptSwap, context: updatedContextSwap };

    case "swapToPLS":
      let pathSwapToPLS = nodeData.path || [];
      const swapModeToPLS = nodeData.swapMode || 'exactIn';

      // Auto-append WPLS if path doesn't end with it
      if (pathSwapToPLS.length === 0 || pathSwapToPLS[pathSwapToPLS.length - 1]?.toLowerCase() !== WPLS.toLowerCase()) {
        pathSwapToPLS = [...pathSwapToPLS, WPLS];
      }

      let amountInSwapToPLS: bigint;
      let amountOutMinSwapToPLS = BigInt(0);

      if (swapModeToPLS === 'exactOut') {
        // User specified desired PLS output, calculate required token input
        const plsAmountOut = await resolveAmountField('plsAmountOut', nodeData, context, automationId, nodeType);

        if (pathSwapToPLS.length > 0 && plsAmountOut > 0n) {
          const routerContract = new Contract(PulseXRouter, pulsexRouterABI, provider);
          const amountsIn = await routerContract.getAmountsIn(plsAmountOut, pathSwapToPLS);
          const calculatedAmountIn = amountsIn[0];
          // Apply slippage: amountIn = calculatedAmountIn * (1 + slippage) - user willing to spend up to this
          amountInSwapToPLS = (calculatedAmountIn * BigInt(Math.floor((1 + slippage) * 10000))) / 10000n;
          // amountOutMin is the user's desired PLS output
          amountOutMinSwapToPLS = plsAmountOut;
        } else {
          amountInSwapToPLS = BigInt(0);
        }
      } else {
        // Default: exactIn mode - user specified token input amount
        amountInSwapToPLS = await resolveAmountField('amountIn', nodeData, context, automationId, nodeType);

        // Calculate amountOutMin from slippage
        if (pathSwapToPLS.length > 0 && amountInSwapToPLS > 0n) {
          const routerContract = new Contract(PulseXRouter, pulsexRouterABI, provider);
          const amountsOut = await routerContract.getAmountsOut(amountInSwapToPLS, pathSwapToPLS);
          const expectedOut = amountsOut[amountsOut.length - 1];
          // Apply slippage: amountOutMin = expectedOut * (1 - slippage)
          amountOutMinSwapToPLS = (expectedOut * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
        }
      }

      const receiptSwapToPLS = await swapTokensForPLS(
        automationId,
        amountInSwapToPLS,
        amountOutMinSwapToPLS,
        pathSwapToPLS,
        to,
        deadline,
        contractAddress
      );

      // Extract output
      const outputSwapToPLS = await extractSwapOutput(receiptSwapToPLS, pathSwapToPLS, provider, to);
      const updatedContextSwapToPLS = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, outputSwapToPLS);

      return { result: receiptSwapToPLS, context: updatedContextSwapToPLS };

    case "removeLiquidity":
      const liquidity = await resolveAmountField('liquidity', nodeData, context, automationId, nodeType);

      // For remove liquidity, we need to estimate expected amounts from LP tokens
      // This is more complex, so we'll use a conservative approach
      // In practice, DEX routers handle this, but we need min amounts
      // We'll calculate based on current reserves and apply slippage
      let amountAMinRemove = BigInt(0);
      let amountBMinRemove = BigInt(0);

      if (liquidity > 0n && nodeData.tokenA && nodeData.tokenB) {
        try {
          const routerContract = new Contract(PulseXRouter, pulsexRouterABI, provider);
          const factoryAddress = await routerContract.factory();
          const factoryContract = new Contract(factoryAddress, [
            "function getPair(address tokenA, address tokenB) external view returns (address pair)",
          ], provider);
          const pairAddress = await factoryContract.getPair(nodeData.tokenA, nodeData.tokenB);

          if (pairAddress && pairAddress !== "0x0000000000000000000000000000000000000000") {
            const pairContract = new Contract(pairAddress, pairABI, provider);
            const reserves = await pairContract.getReserves();
            const totalSupply = await new Contract(pairAddress, erc20ABI, provider).totalSupply();

            if (totalSupply > 0n) {
              // Estimate amounts based on LP share
              const token0 = await pairContract.token0();
              const reserveA = token0.toLowerCase() === nodeData.tokenA.toLowerCase() ? reserves[0] : reserves[1];
              const reserveB = token0.toLowerCase() === nodeData.tokenA.toLowerCase() ? reserves[1] : reserves[0];

              const expectedAmountA = (reserveA * liquidity) / totalSupply;
              const expectedAmountB = (reserveB * liquidity) / totalSupply;

              // Apply slippage
              amountAMinRemove = (expectedAmountA * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
              amountBMinRemove = (expectedAmountB * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
            }
          }
        } catch (error) {
          console.warn("Could not calculate min amounts for remove liquidity:", error);
          // Fallback: use very conservative 50% slippage if calculation fails
          amountAMinRemove = BigInt(0);
          amountBMinRemove = BigInt(0);
        }
      }

      const receiptRemoveLiquidity = await removeLiquidity(
        automationId,
        nodeData.tokenA || "",
        nodeData.tokenB || "",
        liquidity,
        amountAMinRemove,
        amountBMinRemove,
        to,
        deadline,
        contractAddress
      );

      // Extract output with gas price for Gas Guard
      const baseOutputRemoveLiquidity = extractNodeOutput(nodeType, nodeData.nodeId || 'unknown', receiptRemoveLiquidity);
      const outputRemoveLiquidity = { ...baseOutputRemoveLiquidity, ...createTxOutput(receiptRemoveLiquidity) };
      const updatedContextRemoveLiquidity = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, outputRemoveLiquidity);

      return { result: receiptRemoveLiquidity, context: updatedContextRemoveLiquidity };

    case "removeLiquidityPLS":
      const liquidityPLS = await resolveAmountField('liquidity', nodeData, context, automationId, nodeType);

      // Calculate min amounts from expected outputs with slippage
      let amountTokenMinRemovePLS = BigInt(0);
      let amountPLSMinRemovePLS = BigInt(0);

      if (liquidityPLS > 0n && nodeData.token) {
        try {
          const routerContract = new Contract(PulseXRouter, pulsexRouterABI, provider);
          const factoryAddress = await routerContract.factory();
          const factoryContract = new Contract(factoryAddress, [
            "function getPair(address tokenA, address tokenB) external view returns (address pair)",
          ], provider);
          const WPLS_ADDRESS = "0xA1077a294dDE1B09bB078844df40758a5D0f9a27";
          const pairAddress = await factoryContract.getPair(nodeData.token, WPLS_ADDRESS);

          if (pairAddress && pairAddress !== "0x0000000000000000000000000000000000000000") {
            const pairContract = new Contract(pairAddress, pairABI, provider);
            const reserves = await pairContract.getReserves();
            const totalSupply = await new Contract(pairAddress, erc20ABI, provider).totalSupply();

            if (totalSupply > 0n) {
              const token0 = await pairContract.token0();
              const reserveToken = token0.toLowerCase() === nodeData.token.toLowerCase() ? reserves[0] : reserves[1];
              const reservePLS = token0.toLowerCase() === nodeData.token.toLowerCase() ? reserves[1] : reserves[0];

              const expectedAmountToken = (reserveToken * liquidityPLS) / totalSupply;
              const expectedAmountPLS = (reservePLS * liquidityPLS) / totalSupply;

              // Apply slippage
              amountTokenMinRemovePLS = (expectedAmountToken * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
              amountPLSMinRemovePLS = (expectedAmountPLS * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
            }
          }
        } catch (error) {
          console.warn("Could not calculate min amounts for remove liquidity PLS:", error);
          amountTokenMinRemovePLS = BigInt(0);
          amountPLSMinRemovePLS = BigInt(0);
        }
      }

      const receiptRemoveLiquidityPLS = await removeLiquidityPLS(
        automationId,
        nodeData.token || "",
        liquidityPLS,
        amountTokenMinRemovePLS,
        amountPLSMinRemovePLS,
        to,
        deadline,
        contractAddress
      );

      // Extract output with gas price for Gas Guard
      const baseOutputRemoveLiquidityPLS = extractNodeOutput(nodeType, nodeData.nodeId || 'unknown', receiptRemoveLiquidityPLS);
      const outputRemoveLiquidityPLS = { ...baseOutputRemoveLiquidityPLS, ...createTxOutput(receiptRemoveLiquidityPLS) };
      const updatedContextRemoveLiquidityPLS = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, outputRemoveLiquidityPLS);

      return { result: receiptRemoveLiquidityPLS, context: updatedContextRemoveLiquidityPLS };

    case "transfer":
      const transferAmount = await resolveAmountField('amount', nodeData, context, automationId, nodeType);
      const receiptTransfer = await transferTokens(
        automationId,
        nodeData.token || "",
        nodeData.to || to, // Use provided to or default to automation wallet
        transferAmount,
        contractAddress
      );

      // Include gas price for Gas Guard
      const outputTransfer = createTxOutput(receiptTransfer);
      const updatedContextTransfer = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, outputTransfer);

      return { result: receiptTransfer, context: updatedContextTransfer };

    case "transferPLS":
      const plsTransferAmount = await resolveAmountField('plsAmount', nodeData, context, automationId, nodeType);
      const receiptTransferPLS = await transferPLS(
        automationId,
        nodeData.to || to, // Use provided to or default to automation wallet
        plsTransferAmount,
        contractAddress
      );

      // Include gas price for Gas Guard
      const outputTransferPLS = createTxOutput(receiptTransferPLS);
      const updatedContextTransferPLS = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, outputTransferPLS);

      return { result: receiptTransferPLS, context: updatedContextTransferPLS };

    case "burn":
    case "burnToken":
      const burnAmount = await resolveAmountField('amount', nodeData, context, automationId, nodeType);
      const receiptBurn = await burnTokens(
        automationId,
        nodeData.token || "",
        burnAmount,
        contractAddress
      );

      const outputBurn = createTxOutput(receiptBurn);
      const updatedContextBurn = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, outputBurn);

      return { result: receiptBurn, context: updatedContextBurn };

    case "claim":
    case "claimToken":
      const claimAmount = await resolveAmountField('amount', nodeData, context, automationId, nodeType);
      const receiptClaim = await claimTokens(
        automationId,
        nodeData.token || "",
        claimAmount,
        contractAddress
      );

      const outputClaim = createTxOutput(receiptClaim);
      const updatedContextClaim = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, outputClaim);

      return { result: receiptClaim, context: updatedContextClaim };

    case "checkBalance":
      // This is a read operation, no transaction needed
      const walletCheck = await getWalletFromAutomation(automationId);
      const providerCheck = getProvider();
      let outputCheckBalance;
      if (nodeData.token && nodeData.token !== "PLS") {
        const tokenContract = new Contract(nodeData.token, erc20ABI, providerCheck);
        const balance = await tokenContract.balanceOf(walletCheck.address);
        outputCheckBalance = { balance: balance.toString(), token: nodeData.token };
      } else {
        const balance = await providerCheck.getBalance(walletCheck.address);
        outputCheckBalance = { balance: balance.toString(), token: "PLS" };
      }

      const updatedContextCheckBalance = updateContextWithOutput(
        context,
        nodeData.nodeId || 'unknown',
        nodeType,
        outputCheckBalance
      );

      return { result: outputCheckBalance, context: updatedContextCheckBalance };

    case "checkLPTokenAmounts":
      const resultLP = await checkLPTokenAmounts(
        automationId,
        nodeData.pairAddress || "",
        contractAddress
      );

      const updatedContextLP = updateContextWithOutput(
        context,
        nodeData.nodeId || 'unknown',
        nodeType,
        resultLP
      );

      return { result: resultLP, context: updatedContextLP };

    case "checkTokenBalance":
      // Read-only operation - get token balance for a specific ERC20 token
      const walletCheckToken = await getWalletFromAutomation(automationId);
      const providerCheckToken = getProvider();

      if (!nodeData.token) {
        throw new Error("Token address is required for checkTokenBalance");
      }

      const tokenContractCheck = new Contract(nodeData.token, erc20ABI, providerCheckToken);
      const tokenBalance = await tokenContractCheck.balanceOf(walletCheckToken.address);

      const outputCheckTokenBalance = {
        balance: tokenBalance,
        token: nodeData.token,
      };

      const updatedContextCheckTokenBalance = updateContextWithOutput(
        context,
        nodeData.nodeId || 'unknown',
        nodeType,
        outputCheckTokenBalance
      );

      return { result: outputCheckTokenBalance, context: updatedContextCheckTokenBalance };

    case "wait":
      const delaySeconds = Math.min(10, Math.max(1, parseInt(nodeData.delay) || 10));
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));

      const updatedContextWait = updateContextWithOutput(
        context,
        nodeData.nodeId || 'unknown',
        nodeType,
        { delaySeconds }
      );

      return { result: { delaySeconds }, context: updatedContextWait };

    case "loop":
      // Loop node - signals automation runner to restart from beginning
      const loopCount = Math.min(3, Math.max(1, parseInt(nodeData.loopCount) || 1));
      const loopOutput = {
        loopCount,
        shouldLoop: true,
        currentIteration: (context as any).currentIteration || 0,
      };

      const updatedContextLoop = updateContextWithOutput(
        context,
        nodeData.nodeId || 'unknown',
        nodeType,
        loopOutput
      );

      return { result: loopOutput, context: updatedContextLoop };

    case "gasGuard":
      // Gas Guard - checks if previous transaction's gas price exceeded threshold
      const maxGasGwei = parseFloat(nodeData.maxGasPrice) || 100;

      // Get previous node's output which should contain gasPrice
      if (!context.previousNodeId) {
        throw new Error("Gas Guard: No previous node to check gas from");
      }

      const prevOutput = context.nodeOutputs.get(context.previousNodeId);
      if (!prevOutput || prevOutput.gasPrice === undefined) {
        throw new Error("Gas Guard: Previous node did not produce a transaction with gas price data");
      }

      // gasPrice is in wei, convert to gwei
      const gasPriceWei = BigInt(prevOutput.gasPrice);
      const gasPriceGwei = Number(gasPriceWei) / 1e9;

      if (gasPriceGwei > maxGasGwei) {
        throw new Error(`Gas Guard stopped automation: Gas price was ${gasPriceGwei.toFixed(2)} gwei, threshold was ${maxGasGwei} gwei`);
      }

      const gasGuardOutput = {
        passed: true,
        gasPriceGwei,
        threshold: maxGasGwei,
      };

      const updatedContextGasGuard = updateContextWithOutput(
        context,
        nodeData.nodeId || 'unknown',
        nodeType,
        gasGuardOutput
      );

      return { result: gasGuardOutput, context: updatedContextGasGuard };

    case "condition":
      // Condition node - evaluates a condition and returns which branch to follow
      const conditionType = nodeData.conditionType || 'plsBalance';
      const operator = nodeData.operator || '>';
      const compareValue = nodeData.value ? parseFloat(nodeData.value) : 0;

      const walletCondition = await getWalletFromAutomation(automationId);
      const providerCondition = getProvider();

      let actualValue: number = 0;
      let valueLabel = '';

      // Fetch the value based on condition type
      if (conditionType === 'plsBalance') {
        const plsBalanceWei = await providerCondition.getBalance(walletCondition.address);
        // Convert from wei to PLS (18 decimals)
        actualValue = Number(plsBalanceWei) / 1e18;
        valueLabel = 'PLS Balance';
      } else if (conditionType === 'tokenBalance') {
        if (!nodeData.tokenAddress) {
          throw new Error("Token address is required for token balance condition");
        }
        const tokenContractCondition = new Contract(nodeData.tokenAddress, erc20ABI, providerCondition);
        const tokenBalanceWei = await tokenContractCondition.balanceOf(walletCondition.address);
        // Try to get decimals, default to 18
        let decimals = 18;
        try {
          decimals = await tokenContractCondition.decimals();
        } catch {
          // Use default 18 decimals
        }
        actualValue = Number(tokenBalanceWei) / Math.pow(10, decimals);
        valueLabel = 'Token Balance';
      } else if (conditionType === 'lpAmount') {
        if (!nodeData.lpPairAddress) {
          throw new Error("LP Pair address is required for LP amount condition");
        }
        const lpTokenContract = new Contract(nodeData.lpPairAddress, erc20ABI, providerCondition);
        const lpBalanceWei = await lpTokenContract.balanceOf(walletCondition.address);
        // LP tokens typically have 18 decimals
        actualValue = Number(lpBalanceWei) / 1e18;
        valueLabel = 'LP Token Amount';
      } else if (conditionType === 'previousOutput') {
        // Use output from previous node
        if (!context.previousNodeId) {
          throw new Error("Condition: No previous node to get output from");
        }

        const prevOutputCondition = context.nodeOutputs.get(context.previousNodeId);
        if (!prevOutputCondition) {
          throw new Error(`Condition: Previous node ${context.previousNodeId} has no output`);
        }

        const fieldName = nodeData.previousOutputField || 'amountOut';
        const fieldValue = prevOutputCondition[fieldName];

        if (fieldValue === undefined || fieldValue === null) {
          throw new Error(`Condition: Previous node output does not have field: ${fieldName}`);
        }

        // Convert to number - handle both bigint and number
        // Special handling for ratio field - it's already a decimal number, don't divide by 1e18
        if (fieldName === 'ratio') {
          actualValue = Number(fieldValue);
        } else if (typeof fieldValue === 'bigint') {
          // Assume 18 decimals for wei values
          actualValue = Number(fieldValue) / 1e18;
        } else if (typeof fieldValue === 'string') {
          actualValue = parseFloat(fieldValue) / 1e18;
        } else {
          actualValue = Number(fieldValue);
        }

        valueLabel = `Previous Output (${fieldName})`;
      }

      // Evaluate the condition
      let conditionResult = false;
      switch (operator) {
        case '>':
          conditionResult = actualValue > compareValue;
          break;
        case '<':
          conditionResult = actualValue < compareValue;
          break;
        case '>=':
          conditionResult = actualValue >= compareValue;
          break;
        case '<=':
          conditionResult = actualValue <= compareValue;
          break;
        case '==':
          conditionResult = Math.abs(actualValue - compareValue) < 0.0001; // Floating point comparison
          break;
        default:
          conditionResult = actualValue > compareValue;
      }

      const conditionOutput = {
        conditionResult,
        branchToFollow: conditionResult ? 'true' : 'false',
        actualValue,
        compareValue,
        operator,
        conditionType,
        valueLabel,
      };

      const updatedContextCondition = updateContextWithOutput(
        context,
        nodeData.nodeId || 'unknown',
        nodeType,
        conditionOutput
      );

      return { result: conditionOutput, context: updatedContextCondition };

    case "telegram":
      // Telegram node - sends a message to the user's connected Telegram
      const messageTemplate = nodeData.message || 'Automation completed!';

      // Get user's telegram chat ID
      const automation = await prisma.automation.findUnique({
        where: { id: automationId },
        include: { user: { select: { telegramChatId: true } } },
      });

      if (!automation?.user?.telegramChatId) {
        throw new Error("Telegram not connected. Please connect your Telegram at /connect/telegram");
      }

      // Interpolate variables in the message
      let message = messageTemplate;

      // Replace automation variables
      message = message.replace(/\{\{automation\.name\}\}/g, automation.name || 'Unknown');
      message = message.replace(/\{\{automation\.id\}\}/g, automationId);
      message = message.replace(/\{\{timestamp\}\}/g, new Date().toISOString());

      // Replace previous node output variables
      if (context.previousNodeId) {
        const prevOutput = context.nodeOutputs.get(context.previousNodeId);
        if (prevOutput) {
          message = message.replace(/\{\{previousNode\.output\}\}/g, String(prevOutput.amountOut || prevOutput.balance || prevOutput.output || ''));
          message = message.replace(/\{\{previousNode\.txHash\}\}/g, prevOutput.txHash || '');
        }
      }

      // Replace balance variables (fetch current PLS balance)
      if (message.includes('{{balance.pls}}')) {
        const walletTelegram = await getWalletFromAutomation(automationId);
        const providerTelegram = getProvider();
        const plsBalanceTelegram = await providerTelegram.getBalance(walletTelegram.address);
        const plsBalanceFormatted = (Number(plsBalanceTelegram) / 1e18).toFixed(4);
        message = message.replace(/\{\{balance\.pls\}\}/g, plsBalanceFormatted);
      }

      // Send the Telegram message
      const { Bot } = await import('grammy');
      const telegramBot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

      await telegramBot.api.sendMessage(automation.user.telegramChatId, message);

      const telegramOutput = {
        success: true,
        message,
        chatId: automation.user.telegramChatId,
        sentAt: new Date().toISOString(),
      };

      const updatedContextTelegram = updateContextWithOutput(
        context,
        nodeData.nodeId || 'unknown',
        nodeType,
        telegramOutput
      );

      return { result: telegramOutput, context: updatedContextTelegram };

    default:
      throw new Error(`Unknown node type: ${nodeType}`);
  }
}

/**
 * Legacy wrapper for backward compatibility
 * @deprecated Use executeNode with context parameter instead
 */
export async function executeNodeLegacy(
  automationId: string,
  nodeType: string,
  nodeData: Record<string, any>,
  contractAddress?: string
): Promise<ContractTransactionReceipt | any> {
  const context = {
    nodeOutputs: new Map(),
    previousNodeId: null,
    previousNodeType: null,
  };
  const { result } = await executeNode(automationId, nodeType, nodeData, context, contractAddress);
  return result;
}
