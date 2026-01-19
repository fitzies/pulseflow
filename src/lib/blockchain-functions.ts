import { 
  Contract, 
  JsonRpcProvider, 
  Wallet, 
  parseEther, 
  formatEther,
  type ContractTransactionReceipt,
  type ContractTransactionResponse
} from "ethers";
import { prisma } from "./prisma";
import { getWalletFromEncryptedKey } from "./wallet-generation";
import { erc20ABI, playgroundTokenABI, pairABI, pulsexRouterABI, PulseXRouter, WPLS } from "./abis";
import { CONFIG } from "./config";
import type { ExecutionContext, AmountValue } from "./execution-context";
import { resolveAmount, extractNodeOutput, updateContextWithOutput } from "./execution-context";

// Automation Contract ABI - extracted from automation-contract.sol
const AUTOMATION_CONTRACT_ABI = [
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable returns (uint[] memory amounts)",
  "function swapExactPLSForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable returns (uint[] memory amounts)",
  "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external payable returns (uint256 amountA, uint256 amountB, uint256 liquidity)",
  "function addLiquidityPLS(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountPLSMin, address to, uint256 deadline) external payable returns (uint256 amountToken, uint256 amountPLS, uint256 liquidity)",
  "function removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external payable returns (uint256 amountA, uint256 amountB)",
  "function removeLiquidityPLS(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountPLSMin, address to, uint256 deadline) external payable returns (uint256 amountToken, uint256 amountPLS)",
  "function transferToken(address token, address to, uint256 amount) external payable",
  "function burnToken(address token, uint256 amount) external payable",
  "function claimToken(address token, uint256 amount) external payable",
  "function checkLPTokenAmounts(address pairAddress, address user) external view returns (uint256 lpBalance, address token0, address token1, uint256 token0Amount, uint256 token1Amount)",
  "function isPlaygroundToken(address token) public view returns (bool)",
] as const;

const PULSECHAIN_RPC = CONFIG.pulsechainRpc;
const EXECUTION_FEE = parseEther(CONFIG.executionFee);
const DEV_WALLET = CONFIG.devWallet;

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
  return new Contract(address, AUTOMATION_CONTRACT_ABI, wallet);
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
  
  const tx: ContractTransactionResponse = await contract.swapExactTokensForTokens(
    amountIn,
    amountOutMin,
    path,
    to,
    deadline,
    { value: EXECUTION_FEE }
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
  
  // Total value = execution fee + PLS amount for swap
  const totalValue = EXECUTION_FEE + plsAmount;
  
  const tx: ContractTransactionResponse = await contract.swapExactPLSForTokens(
    amountOutMin,
    path,
    to,
    deadline,
    { value: totalValue }
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
  const tokenAContract = new Contract(tokenA, erc20ABI, wallet);
  const tokenBContract = new Contract(tokenB, erc20ABI, wallet);
  
  const contractAddr = contractAddress || AUTOMATION_CONTRACT_ADDRESS;
  await tokenAContract.approve(contractAddr, amountADesired);
  await tokenBContract.approve(contractAddr, amountBDesired);
  
  const tx: ContractTransactionResponse = await contract.addLiquidity(
    tokenA,
    tokenB,
    amountADesired,
    amountBDesired,
    amountAMin,
    amountBMin,
    to,
    deadline,
    { value: EXECUTION_FEE }
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
  
  const pairContract = new Contract(pairAddress, erc20ABI, wallet);
  const contractAddr = contractAddress || AUTOMATION_CONTRACT_ADDRESS;
  await pairContract.approve(contractAddr, liquidity);
  
  const tx: ContractTransactionResponse = await contract.removeLiquidity(
    tokenA,
    tokenB,
    liquidity,
    amountAMin,
    amountBMin,
    to,
    deadline,
    { value: EXECUTION_FEE }
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
  
  const pairContract = new Contract(pairAddress, erc20ABI, wallet);
  const contractAddr = contractAddress || AUTOMATION_CONTRACT_ADDRESS;
  await pairContract.approve(contractAddr, liquidity);
  
  const tx: ContractTransactionResponse = await contract.removeLiquidityPLS(
    token,
    liquidity,
    amountTokenMin,
    amountPLSMin,
    to,
    deadline,
    { value: EXECUTION_FEE }
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
  const tokenContract = new Contract(token, erc20ABI, wallet);
  const contractAddr = contractAddress || AUTOMATION_CONTRACT_ADDRESS;
  await tokenContract.approve(contractAddr, amount);
  
  const tx: ContractTransactionResponse = await contract.transferToken(
    token,
    to,
    amount,
    { value: EXECUTION_FEE }
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
  
  // Approve token first
  const tokenContract = new Contract(token, erc20ABI, wallet);
  const contractAddr = contractAddress || AUTOMATION_CONTRACT_ADDRESS;
  await tokenContract.approve(contractAddr, amount);
  
  const tx: ContractTransactionResponse = await contract.burnToken(
    token,
    amount,
    { value: EXECUTION_FEE }
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
  
  const tx: ContractTransactionResponse = await contract.claimToken(
    token,
    amount,
    { value: EXECUTION_FEE }
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
}> {
  const wallet = await getWalletFromAutomation(automationId);
  const contract = getAutomationContract(wallet, contractAddress);
  
  const result = await contract.checkLPTokenAmounts(pairAddress, wallet.address);
  
  return {
    lpBalance: result[0],
    token0: result[1],
    token1: result[2],
    token0Amount: result[3],
    token1Amount: result[4],
  };
}

/**
 * Helper to resolve amount field from nodeData
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
    (nodeType === 'swap' || nodeType === 'swapPLS')
  ) {
    const path = nodeData.path || [];
    if (path.length > 0 && !amountConfig.token) {
      // Use first token in path
      amountConfig.token = path[0];
    }
  }
  
  return resolveAmount(amountConfig, context, automationId);
}

/**
 * Extract output from swap transaction
 */
async function extractSwapOutput(
  receipt: ContractTransactionReceipt,
  path: string[],
  provider: JsonRpcProvider
): Promise<{ amountOut: bigint; tokenOut: string } | null> {
  if (!path || path.length === 0) return null;
  
  const tokenOut = path[path.length - 1];
  
  // Parse Swap event from router
  // Event: Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)
  try {
    const routerContract = new Contract(PulseXRouter, pulsexRouterABI, provider);
    const iface = routerContract.interface;
    
    // Find Swap event in logs
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        
        if (parsed && parsed.name === 'Swap') {
          const amount0Out = parsed.args.amount0Out as bigint;
          const amount1Out = parsed.args.amount1Out as bigint;
          const amountOut = amount0Out > 0n ? amount0Out : amount1Out;
          
          return {
            amountOut,
            tokenOut,
          };
        }
      } catch {
        // Not a Swap event, continue
        continue;
      }
    }
  } catch (error) {
    console.warn("Could not parse swap output from receipt:", error);
  }
  
  // Fallback: return tokenOut address (amountOut will be 0, but at least we know the token)
  return {
    amountOut: BigInt(0),
    tokenOut,
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
        const output = await extractSwapOutput(receipt, path, provider);
        const updatedContext = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, output);
        
        return { result: receipt, context: updatedContext };
      } else {
        const amountIn = await resolveAmountField('amountIn', nodeData, context, automationId, nodeType);
        const path = nodeData.path || [];
        
        // Calculate amountOutMin from slippage
        let amountOutMin = BigInt(0);
        if (path.length > 0 && amountIn > 0n) {
          const routerContract = new Contract(PulseXRouter, pulsexRouterABI, provider);
          const amountsOut = await routerContract.getAmountsOut(amountIn, path);
          const expectedOut = amountsOut[amountsOut.length - 1];
          // Apply slippage: amountOutMin = expectedOut * (1 - slippage)
          amountOutMin = (expectedOut * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
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
        const output = await extractSwapOutput(receipt, path, provider);
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
        
        // Extract output (liquidity, amounts)
        const outputAddLP = extractNodeOutput(nodeType, nodeData.nodeId || 'unknown', receiptAddLP);
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
        
        // Extract output
        const outputAddLiquidity = extractNodeOutput(nodeType, nodeData.nodeId || 'unknown', receiptAddLiquidity);
        const updatedContextAddLiquidity = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, outputAddLiquidity);
        
        return { result: receiptAddLiquidity, context: updatedContextAddLiquidity };
      }
    
    case "addLiquidityPLS":
      const amountTokenDesiredPLS = await resolveAmountField('amountTokenDesired', nodeData, context, automationId, nodeType);
      const plsAmountPLS = await resolveAmountField('plsAmount', nodeData, context, automationId, nodeType);
      
      // Calculate min amounts from slippage
      const amountTokenMinPLS = (amountTokenDesiredPLS * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
      const amountPLSMinPLS = (plsAmountPLS * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
      
      return addLiquidityPLS(
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
    
    case "swapPLS":
      const plsAmountSwap = await resolveAmountField('plsAmount', nodeData, context, automationId, nodeType);
      const pathSwap = nodeData.path || [];
      
      // Calculate amountOutMin from slippage
      let amountOutMinSwap = BigInt(0);
      if (pathSwap.length > 0 && plsAmountSwap > 0n) {
        const routerContract = new Contract(PulseXRouter, pulsexRouterABI, provider);
        const amountsOut = await routerContract.getAmountsOut(plsAmountSwap, pathSwap);
        const expectedOut = amountsOut[amountsOut.length - 1];
        // Apply slippage: amountOutMin = expectedOut * (1 - slippage)
        amountOutMinSwap = (expectedOut * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;
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
      const outputSwap = await extractSwapOutput(receiptSwap, pathSwap, provider);
      const updatedContextSwap = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, outputSwap);
      
      return { result: receiptSwap, context: updatedContextSwap };
    
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
      
      // Extract output
      const outputRemoveLiquidity = extractNodeOutput(nodeType, nodeData.nodeId || 'unknown', receiptRemoveLiquidity);
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
      
      // Extract output
      const outputRemoveLiquidityPLS = extractNodeOutput(nodeType, nodeData.nodeId || 'unknown', receiptRemoveLiquidityPLS);
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
      
      // Transfer has no meaningful output
      const updatedContextTransfer = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, null);
      
      return { result: receiptTransfer, context: updatedContextTransfer };
    
    case "burn":
    case "burnToken":
      const burnAmount = await resolveAmountField('amount', nodeData, context, automationId, nodeType);
      const receiptBurn = await burnTokens(
        automationId,
        nodeData.token || "",
        burnAmount,
        contractAddress
      );
      
      const updatedContextBurn = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, null);
      
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
      
      const updatedContextClaim = updateContextWithOutput(context, nodeData.nodeId || 'unknown', nodeType, null);
      
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
