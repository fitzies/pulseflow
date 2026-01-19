#!/usr/bin/env node

import { 
  Contract, 
  JsonRpcProvider, 
  Wallet, 
  parseEther, 
  formatEther,
  type ContractTransactionReceipt,
  type ContractTransactionResponse
} from "ethers";
import { CONFIG } from "../src/lib/config";
import { erc20ABI, playgroundTokenABI, pairABI, PulseXRouter } from "../src/lib/abis";

// Test private key
const TEST_PRIVATE_KEY = "334354be61de8bd4fdcd8f2090a4980cb84a511bb116735641c4f95350cc7e7c";

// Automation Contract ABI
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

const EXECUTION_FEE = parseEther(CONFIG.executionFee);

// Test results interface
interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  txHash?: string;
  data?: any;
}

// Test results storage
const testResults: TestResult[] = [];

/**
 * Log test result
 */
function logResult(result: TestResult) {
  testResults.push(result);
  const status = result.success ? "✅ PASS" : "❌ FAIL";
  console.log(`\n${status}: ${result.name}`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
  if (result.txHash) {
    console.log(`   TX Hash: ${result.txHash}`);
  }
  if (result.data) {
    console.log(`   Data:`, result.data);
  }
}

/**
 * Get wallet balance
 */
async function getBalance(provider: JsonRpcProvider, address: string): Promise<string> {
  const balance = await provider.getBalance(address);
  return formatEther(balance);
}

/**
 * Test isPlaygroundToken view function
 */
async function testIsPlaygroundToken(
  contract: Contract,
  testToken: string
): Promise<TestResult> {
  try {
    const result = await contract.isPlaygroundToken(testToken);
    return {
      name: "isPlaygroundToken",
      success: true,
      data: { token: testToken, isPlayground: result },
    };
  } catch (error) {
    return {
      name: "isPlaygroundToken",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test checkLPTokenAmounts view function
 */
async function testCheckLPTokenAmounts(
  contract: Contract,
  pairAddress: string,
  userAddress: string
): Promise<TestResult> {
  try {
    const result = await contract.checkLPTokenAmounts(pairAddress, userAddress);
    return {
      name: "checkLPTokenAmounts",
      success: true,
      data: {
        lpBalance: result[0].toString(),
        token0: result[1],
        token1: result[2],
        token0Amount: result[3].toString(),
        token1Amount: result[4].toString(),
      },
    };
  } catch (error) {
    return {
      name: "checkLPTokenAmounts",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test swapExactPLSForTokens (swap PLS directly to tokens)
 */
async function testSwapPLSForTokens(
  contract: Contract,
  wallet: Wallet,
  amountOutMin: bigint,
  path: string[],
  deadline: bigint,
  plsAmount: bigint
): Promise<TestResult> {
  try {
    // Total value = execution fee + PLS amount for swap
    const totalValue = EXECUTION_FEE + plsAmount;

    const tx: ContractTransactionResponse = await contract.swapExactPLSForTokens(
      amountOutMin,
      path,
      wallet.address,
      deadline,
      { value: totalValue }
    );

    const receipt = await tx.wait();
    return {
      name: "swapExactPLSForTokens",
      success: true,
      txHash: receipt?.hash,
      data: { amounts: receipt?.logs },
    };
  } catch (error) {
    return {
      name: "swapExactPLSForTokens",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test swapExactTokensForTokens
 */
async function testSwap(
  contract: Contract,
  wallet: Wallet,
  amountIn: bigint,
  path: string[],
  deadline: bigint
): Promise<TestResult> {
  try {
    // Approve token if needed
    const tokenContract = new Contract(path[0], erc20ABI, wallet);
    const allowance = await tokenContract.allowance(wallet.address, CONFIG.automationContract);
    if (allowance < amountIn) {
      const approveTx = await tokenContract.approve(CONFIG.automationContract, amountIn);
      await approveTx.wait();
    }

    const tx: ContractTransactionResponse = await contract.swapExactTokensForTokens(
      amountIn,
      0n, // amountOutMin - set to 0 for testing
      path,
      wallet.address,
      deadline,
      { value: EXECUTION_FEE }
    );

    const receipt = await tx.wait();
    return {
      name: "swapExactTokensForTokens",
      success: true,
      txHash: receipt?.hash,
      data: { amounts: receipt?.logs },
    };
  } catch (error) {
    return {
      name: "swapExactTokensForTokens",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test addLiquidityPLS (add liquidity with PLS + token)
 */
async function testAddLiquidityPLS(
  contract: Contract,
  wallet: Wallet,
  token: string,
  amountTokenDesired: bigint,
  amountPLSDesired: bigint,
  deadline: bigint
): Promise<TestResult> {
  try {
    // Check token balance
    const tokenContract = new Contract(token, erc20ABI, wallet);
    const balance = await tokenContract.balanceOf(wallet.address);
    
    if (balance < amountTokenDesired) {
      return {
        name: "addLiquidityPLS",
        success: false,
        error: `Insufficient token balance: have ${formatEther(balance)}, need ${formatEther(amountTokenDesired)}`,
      };
    }
    
    // Approve token (check allowance first)
    const allowance = await tokenContract.allowance(wallet.address, CONFIG.automationContract);
    if (allowance < amountTokenDesired) {
      const approveTx = await tokenContract.approve(CONFIG.automationContract, amountTokenDesired);
      await approveTx.wait();
    }

    // Total value = execution fee + PLS amount for liquidity
    const totalValue = EXECUTION_FEE + amountPLSDesired;

    const tx: ContractTransactionResponse = await contract.addLiquidityPLS(
      token,
      amountTokenDesired,
      0n, // amountTokenMin
      0n, // amountPLSMin
      wallet.address,
      deadline,
      { value: totalValue }
    );

    const receipt = await tx.wait();
    return {
      name: "addLiquidityPLS",
      success: true,
      txHash: receipt?.hash,
    };
  } catch (error) {
    return {
      name: "addLiquidityPLS",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test removeLiquidity
 */
async function testRemoveLiquidity(
  contract: Contract,
  wallet: Wallet,
  tokenA: string,
  tokenB: string,
  liquidity: bigint,
  deadline: bigint
): Promise<TestResult> {
  try {
    // Get pair address
    const routerContract = new Contract(PulseXRouter, [
      "function factory() external pure returns (address)",
    ], wallet.provider!);
    
    const factoryAddress = await routerContract.factory();
    const factoryContract = new Contract(factoryAddress, [
      "function getPair(address tokenA, address tokenB) external view returns (address pair)",
    ], wallet.provider!);
    
    const pairAddress = await factoryContract.getPair(tokenA, tokenB);
    if (!pairAddress || pairAddress === "0x0000000000000000000000000000000000000000") {
      return {
        name: "removeLiquidity",
        success: false,
        error: "Pair does not exist",
      };
    }

    // Approve LP tokens
    const pairContract = new Contract(pairAddress, erc20ABI, wallet);
    await pairContract.approve(CONFIG.automationContract, liquidity);

    const tx: ContractTransactionResponse = await contract.removeLiquidity(
      tokenA,
      tokenB,
      liquidity,
      0n, // amountAMin
      0n, // amountBMin
      wallet.address,
      deadline,
      { value: EXECUTION_FEE }
    );

    const receipt = await tx.wait();
    return {
      name: "removeLiquidity",
      success: true,
      txHash: receipt?.hash,
    };
  } catch (error) {
    return {
      name: "removeLiquidity",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test transferToken
 */
async function testTransferToken(
  contract: Contract,
  wallet: Wallet,
  token: string,
  to: string,
  amount: bigint
): Promise<TestResult> {
  try {
    // Approve token
    const tokenContract = new Contract(token, erc20ABI, wallet);
    await tokenContract.approve(CONFIG.automationContract, amount);

    const tx: ContractTransactionResponse = await contract.transferToken(
      token,
      to,
      amount,
      { value: EXECUTION_FEE }
    );

    const receipt = await tx.wait();
    return {
      name: "transferToken",
      success: true,
      txHash: receipt?.hash,
    };
  } catch (error) {
    return {
      name: "transferToken",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test burnToken (wraps parent tokens into PlaygroundTokens)
 */
async function testBurnToken(
  contract: Contract,
  wallet: Wallet,
  token: string,
  amount: bigint
): Promise<TestResult> {
  try {
    // Check if playground token
    const isPlayground = await contract.isPlaygroundToken(token);
    if (!isPlayground) {
      return {
        name: "burnToken",
        success: false,
        error: "Token is not a playground token",
      };
    }

    // Get parent token address
    const playgroundTokenContract = new Contract(token, playgroundTokenABI, wallet.provider!);
    const parentToken = await playgroundTokenContract.parent();
    
    // Check parent token balance (user needs parent tokens to wrap)
    const parentContractRead = new Contract(parentToken, erc20ABI, wallet.provider!);
    const parentBalance = await parentContractRead.balanceOf(wallet.address);
    
    if (parentBalance < amount) {
      return {
        name: "burnToken",
        success: false,
        error: `Insufficient parent token balance: have ${formatEther(parentBalance)}, need ${formatEther(amount)}`,
      };
    }

    // Approve parent token to automation contract (need signer for write operations)
    const parentContract = new Contract(parentToken, erc20ABI, wallet);
    const allowance = await parentContract.allowance(wallet.address, CONFIG.automationContract);
    if (allowance < amount) {
      const approveTx = await parentContract.approve(CONFIG.automationContract, amount);
      await approveTx.wait();
    }

    const tx: ContractTransactionResponse = await contract.burnToken(
      token,
      amount,
      { value: EXECUTION_FEE }
    );

    const receipt = await tx.wait();
    return {
      name: "burnToken",
      success: true,
      txHash: receipt?.hash,
    };
  } catch (error) {
    return {
      name: "burnToken",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test claimToken (unwraps PlaygroundTokens back to parent tokens)
 */
async function testClaimToken(
  contract: Contract,
  wallet: Wallet,
  token: string,
  amount: bigint
): Promise<TestResult> {
  try {
    // Check if playground token
    const isPlayground = await contract.isPlaygroundToken(token);
    if (!isPlayground) {
      return {
        name: "claimToken",
        success: false,
        error: "Token is not a playground token",
      };
    }

    // Check PlaygroundToken balance (user needs PlaygroundTokens to unwrap)
    const tokenContract = new Contract(token, erc20ABI, wallet);
    const balance = await tokenContract.balanceOf(wallet.address);
    
    if (balance < amount) {
      return {
        name: "claimToken",
        success: false,
        error: `Insufficient PlaygroundToken balance: have ${formatEther(balance)}, need ${formatEther(amount)}`,
      };
    }

    // Approve PlaygroundToken to automation contract
    const allowance = await tokenContract.allowance(wallet.address, CONFIG.automationContract);
    if (allowance < amount) {
      const approveTx = await tokenContract.approve(CONFIG.automationContract, amount);
      await approveTx.wait();
    }
    
    const tx: ContractTransactionResponse = await contract.claimToken(
      token,
      amount,
      { value: EXECUTION_FEE }
    );

    const receipt = await tx.wait();
    return {
      name: "claimToken",
      success: true,
      txHash: receipt?.hash,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      name: "claimToken",
      success: false,
      error: `${errorMsg}. Note: claim() unwraps PlaygroundTokens - user must have PlaygroundTokens to unwrap.`,
    };
  }
}

/**
 * Main test function
 */
async function main() {
  console.log("🚀 Starting Contract Tests");
  console.log("=" .repeat(50));
  console.log(`Contract Address: ${CONFIG.automationContract}`);
  console.log(`RPC: ${CONFIG.pulsechainRpc}`);
  console.log(`Execution Fee: ${CONFIG.executionFee} PLS`);
  console.log("=" .repeat(50));

  // Create provider and wallet
  const provider = new JsonRpcProvider(CONFIG.pulsechainRpc);
  const wallet = new Wallet(TEST_PRIVATE_KEY, provider);
  
  console.log(`\nTest Wallet: ${wallet.address}`);
  const balance = await getBalance(provider, wallet.address);
  console.log(`Balance: ${balance} PLS`);

  if (parseFloat(balance) < 200) {
    console.warn("\n⚠️  Warning: Low balance. Tests may fail due to insufficient funds.");
    console.warn("   Each write operation costs 100 PLS fee + gas costs.");
  }

  // Create contract instance
  const contract = new Contract(CONFIG.automationContract, AUTOMATION_CONTRACT_ABI, wallet);

  // Test deadline (1 hour from now)
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  console.log("\n📋 Running Tests...\n");

  // ENSU token address
  const ENSU_TOKEN = "0xb27DB93725523219a8B49168550eAb660B4c3Aa9";

  // Test 1: isPlaygroundToken (view function)
  console.log("Testing view functions...");
  await logResult(await testIsPlaygroundToken(contract, CONFIG.wpls));
  await logResult(await testIsPlaygroundToken(contract, ENSU_TOKEN));
  await logResult(await testIsPlaygroundToken(contract, "0x0000000000000000000000000000000000000000"));

  // Test 2: checkLPTokenAmounts (view function)
  // Note: This will fail if wallet has no LP positions, which is expected
  const routerContract = new Contract(PulseXRouter, [
    "function factory() external pure returns (address)",
  ], provider);
  const factoryAddress = await routerContract.factory();
  const factoryContract = new Contract(factoryAddress, [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  ], provider);

  // Try to find ENSU/WPLS pair (before adding liquidity)
  try {
    const ensuPair = await factoryContract.getPair(CONFIG.wpls, ENSU_TOKEN);
    if (ensuPair && ensuPair !== "0x0000000000000000000000000000000000000000") {
      await logResult(await testCheckLPTokenAmounts(contract, ensuPair, wallet.address));
    } else {
      logResult({
        name: "checkLPTokenAmounts (before)",
        success: false,
        error: "No ENSU/WPLS pair found yet (will be created after adding liquidity)",
      });
    }
  } catch (error) {
    logResult({
      name: "checkLPTokenAmounts (before)",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test write functions with ENSU
  console.log("\n🚀 Running Write Function Tests...");
  console.log("⚠️  Each operation costs 100 PLS fee + gas costs.\n");

  // Step 1: Swap PLS directly to ENSU (no wrapping needed!)
  console.log("Step 1: Swapping PLS directly to ENSU...");
  const plsSwapAmount = parseEther("0.5"); // Swap 0.5 PLS
  const swapPath = [CONFIG.wpls, ENSU_TOKEN]; // Path: WPLS -> ENSU (router wraps PLS to WPLS internally)
  await logResult(await testSwapPLSForTokens(contract, wallet, 0n, swapPath, deadline, plsSwapAmount));

  // Check ENSU balance
  const ensuContract = new Contract(ENSU_TOKEN, erc20ABI, wallet.provider!);
  const ensuBalance = await ensuContract.balanceOf(wallet.address);
  console.log(`   ENSU Balance: ${formatEther(ensuBalance)} ENSU\n`);

  // Step 2: Add Liquidity with PLS + ENSU (no WPLS needed!)
  console.log("Step 2: Adding Liquidity (PLS + ENSU)...");
  const plsForLiq = parseEther("0.3"); // 0.3 PLS
  const ensuForLiq = ensuBalance / 2n; // Use half of ENSU balance
  await logResult(await testAddLiquidityPLS(
    contract,
    wallet,
    ENSU_TOKEN,
    ensuForLiq,
    plsForLiq,
    deadline
  ));

  // Step 3: Check LP Token Amounts after adding liquidity
  console.log("Step 3: Checking LP Token Amounts...");
  try {
    const pairAddress = await factoryContract.getPair(CONFIG.wpls, ENSU_TOKEN);
    if (pairAddress && pairAddress !== "0x0000000000000000000000000000000000000000") {
      await logResult(await testCheckLPTokenAmounts(contract, pairAddress, wallet.address));
      
      // Also check LP token balance directly
      const pairContract = new Contract(pairAddress, erc20ABI, wallet.provider!);
      const lpBalance = await pairContract.balanceOf(wallet.address);
      console.log(`   LP Token Balance: ${formatEther(lpBalance)} LP tokens\n`);
    } else {
      logResult({
        name: "checkLPTokenAmounts (ENSU/WPLS)",
        success: false,
        error: "Pair not found - may need to create pair first",
      });
    }
  } catch (error) {
    logResult({
      name: "checkLPTokenAmounts (ENSU/WPLS)",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Step 4: Burn/Wrap ENSU token (wraps parent tokens into PlaygroundTokens)
  console.log("\nStep 4: Wrapping parent tokens into ENSU (burn)...");
  
  // Get parent token address
  const playgroundTokenContract = new Contract(ENSU_TOKEN, playgroundTokenABI, wallet.provider!);
  const parentToken = await playgroundTokenContract.parent();
  const parentContract = new Contract(parentToken, erc20ABI, wallet.provider!);
  
  // Check parent token balance
  const parentBalance = await parentContract.balanceOf(wallet.address);
  const burnAmount = parentBalance > 0n ? parentBalance / 4n : 0n; // Wrap 1/4 of parent tokens
  
  if (burnAmount > 0n) {
    console.log(`   Wrapping ${formatEther(burnAmount)} parent tokens into ENSU...`);
    await logResult(await testBurnToken(contract, wallet, ENSU_TOKEN, burnAmount));
    
    // Check ENSU balance after wrap (should increase)
    const ensuBalanceAfterBurn = await ensuContract.balanceOf(wallet.address);
    console.log(`   ENSU Balance after wrap: ${formatEther(ensuBalanceAfterBurn)} ENSU\n`);
  } else {
    logResult({
      name: "burnToken",
      success: false,
      error: "Insufficient parent token balance to wrap",
    });
  }

  // Step 5: Claim/Unwrap ENSU token (unwraps PlaygroundTokens back to parent tokens)
  console.log("Step 5: Unwrapping ENSU back to parent tokens (claim)...");
  const currentEnsuBalanceForClaim = await ensuContract.balanceOf(wallet.address);
  const claimAmount = currentEnsuBalanceForClaim > 0n ? currentEnsuBalanceForClaim / 4n : 0n; // Unwrap 1/4 of ENSU
  
  if (claimAmount > 0n) {
    console.log(`   Unwrapping ${formatEther(claimAmount)} ENSU...`);
    await logResult(await testClaimToken(contract, wallet, ENSU_TOKEN, claimAmount));
    
    // Check balances after unwrap
    const ensuBalanceAfterClaim = await ensuContract.balanceOf(wallet.address);
    const parentBalanceAfterClaim = await parentContract.balanceOf(wallet.address);
    console.log(`   ENSU Balance after unwrap: ${formatEther(ensuBalanceAfterClaim)} ENSU`);
    console.log(`   Parent Token Balance after unwrap: ${formatEther(parentBalanceAfterClaim)} parent tokens\n`);
  } else {
    logResult({
      name: "claimToken",
      success: false,
      error: "Insufficient ENSU balance to unwrap",
    });
  }
  
  // Final balance check
  console.log("📊 Final Balances:");
  const finalPlsBalance = await getBalance(provider, wallet.address);
  const wplsContract = new Contract(CONFIG.wpls, erc20ABI, wallet.provider!);
  const finalWplsBalance = await wplsContract.balanceOf(wallet.address);
  const finalEnsuBalance = await ensuContract.balanceOf(wallet.address);
  console.log(`   PLS: ${finalPlsBalance} PLS`);
  console.log(`   WPLS: ${formatEther(finalWplsBalance)} WPLS`);
  console.log(`   ENSU: ${formatEther(finalEnsuBalance)} ENSU\n`);

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Summary");
  console.log("=".repeat(50));
  const passed = testResults.filter(r => r.success).length;
  const failed = testResults.filter(r => !r.success).length;
  console.log(`Total Tests: ${testResults.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log("=".repeat(50));

  if (failed > 0) {
    console.log("\nFailed Tests:");
    testResults.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
}

// Run tests
main().catch(console.error);
