import {
  Contract,
  JsonRpcProvider,
  MaxUint256,
  type ContractTransactionReceipt,
  type Wallet,
} from "ethers";
import { CONFIG } from "./config";
import { erc20ABI, PulseXSwapRouter as PulseXSwapRouterABI } from "./abis";

const PULSECHAIN_RPC = CONFIG.pulsechainRpc;
const PULSEX_FACTORY_V2 = CONFIG.pulseXFactory;
const PULSEX_FACTORY_V1 = CONFIG.pulseXFactoryV1;
const PULSEX_SWAP_ROUTER = CONFIG.pulseXSwapRouter;
const WPLS_ADDRESS = CONFIG.wpls;

const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address)",
];
const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
];
const ROUTER_V2_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
  "function getAmountsIn(uint256 amountOut, address[] path) view returns (uint256[] amounts)",
];

const BASE_TOKENS = [
  WPLS_ADDRESS,
  "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39", // HEX
  "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab", // PLSX
  "0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d", // INC
  "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI (bridged)
];

let _provider: JsonRpcProvider | null = null;
function getSmartRouterProvider(): JsonRpcProvider {
  if (!_provider) _provider = new JsonRpcProvider(PULSECHAIN_RPC);
  return _provider;
}

async function pairExists(
  factory: Contract,
  tokenA: string,
  tokenB: string,
): Promise<boolean> {
  if (tokenA.toLowerCase() === tokenB.toLowerCase()) return false;
  const pair: string = await factory.getPair(tokenA, tokenB);
  return pair !== "0x0000000000000000000000000000000000000000";
}

interface CandidatePath {
  path: string[];
  amountOut: bigint;
  amountIn: bigint;
}

/**
 * Build candidate paths and select the best quote for the requested swap mode.
 * Checks direct pair + 2-hop routes via each base token.
 */
export async function findBestPath(
  tokenIn: string,
  tokenOut: string,
  amount: bigint,
  swapMode: "exactIn" | "exactOut" = "exactIn",
): Promise<CandidatePath> {
  if (amount <= 0n) throw new Error("Swap amount must be greater than zero");
  const provider = getSmartRouterProvider();
  const factoryV2 = new Contract(PULSEX_FACTORY_V2, FACTORY_ABI, provider);
  const router = new Contract(CONFIG.pulseXRouter, ROUTER_V2_ABI, provider);

  const candidates: string[][] = [];

  // Direct path
  candidates.push([tokenIn, tokenOut]);

  // 2-hop paths via base tokens
  for (const base of BASE_TOKENS) {
    const baseLower = base.toLowerCase();
    if (
      baseLower === tokenIn.toLowerCase() ||
      baseLower === tokenOut.toLowerCase()
    )
      continue;
    candidates.push([tokenIn, base, tokenOut]);
  }

  // Check which paths are valid (pairs exist) in parallel
  const validityChecks = await Promise.all(
    candidates.map(async (path) => {
      for (let i = 0; i < path.length - 1; i++) {
        if (!(await pairExists(factoryV2, path[i], path[i + 1]))) return false;
      }
      return true;
    }),
  );

  const validPaths = candidates.filter((_, i) => validityChecks[i]);
  if (validPaths.length === 0) {
    throw new Error("No valid PulseX V2 route found for this token pair");
  }

  // Quote each valid path and pick the best
  const quotes = await Promise.all(
    validPaths.map(async (path) => {
      try {
        const amounts: bigint[] = swapMode === "exactOut"
          ? await router.getAmountsIn(amount, path)
          : await router.getAmountsOut(amount, path);
        return { path, amountIn: amounts[0], amountOut: amounts[amounts.length - 1] };
      } catch {
        return { path, amountIn: 0n, amountOut: 0n };
      }
    }),
  );

  const usableQuotes = quotes.filter(quote => quote.amountIn > 0n && quote.amountOut > 0n);
  if (usableQuotes.length === 0) {
    throw new Error("No PulseX V2 route could quote the requested amount");
  }
  const best = usableQuotes.reduce((a, b) => swapMode === "exactOut"
    ? (b.amountIn < a.amountIn ? b : a)
    : (b.amountOut > a.amountOut ? b : a));

  return best;
}

/**
 * Execute a swap through the PulseX Smart Router (V1/V2 unified router).
 * Finds optimal path on-chain, encodes calldata, sends tx.
 * No external API — no rate limits.
 */
export async function executePulseXSmartSwap(
  automationId: string,
  tokenIn: string,
  tokenOut: string,
  amount: bigint,
  slippage: number,
  to: string,
  getWallet: (id: string) => Promise<Wallet>,
  getEthersProvider: () => JsonRpcProvider,
  swapMode: "exactIn" | "exactOut" = "exactIn",
): Promise<ContractTransactionReceipt> {
  if (!Number.isFinite(slippage) || slippage < 0 || slippage >= 1) {
    throw new Error("Slippage must be between 0 and 1");
  }
  const wallet = await getWallet(automationId);
  const provider = getEthersProvider();
  const connectedWallet = wallet.provider ? wallet : wallet.connect(provider);

  const tokenInAddr =
    tokenIn.toUpperCase() === "PLS" ? WPLS_ADDRESS : tokenIn;
  const tokenOutAddr =
    tokenOut.toUpperCase() === "PLS" ? WPLS_ADDRESS : tokenOut;

  const best = await findBestPath(tokenInAddr, tokenOutAddr, amount, swapMode);
  // Match manual Amount Out swaps: spend the buffered input and enforce the
  // requested output as an on-chain minimum. Round input up to avoid underfunding.
  const amountIn = swapMode === "exactOut"
    ? (best.amountIn * BigInt(10000 + Math.round(slippage * 10000)) + 9999n) / 10000n
    : amount;
  const amountOutMin = swapMode === "exactOut"
    ? amount
    : (best.amountOut * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;

  // Approve input token to Smart Router
  if (tokenIn.toUpperCase() !== "PLS") {
    const tokenContract = new Contract(tokenIn, erc20ABI, connectedWallet);
    const allowance: bigint = await tokenContract.allowance(
      wallet.address,
      PULSEX_SWAP_ROUTER,
    );
    if (allowance < amountIn) {
      const approveTx = await tokenContract.approve(
        PULSEX_SWAP_ROUTER,
        MaxUint256,
      );
      await approveTx.wait();
    }
  }

  const smartRouter = new Contract(
    PULSEX_SWAP_ROUTER,
    PulseXSwapRouterABI,
    connectedWallet,
  );

  let tx;
  if (tokenIn.toUpperCase() === "PLS") {
    // Native PLS → token: use swapExactTokensForTokensV2 via WPLS path, send value
    tx = await smartRouter.swapExactTokensForTokensV2(
      amountIn,
      amountOutMin,
      best.path,
      to,
      { value: amountIn },
    );
  } else {
    tx = await smartRouter.swapExactTokensForTokensV2(
      amountIn,
      amountOutMin,
      best.path,
      to,
    );
  }

  const receipt = await tx.wait();
  if (!receipt)
    throw new Error("PulseX SmartRouter swap transaction receipt is null");
  return receipt as ContractTransactionReceipt;
}

/**
 * Execute swap tokens → native PLS via Smart Router multicall.
 * Swaps to WPLS, then unwraps to native PLS. No Piteas, no rate limits.
 * @param amountOutMinOverride - For exactOut mode: use this as amountOutMin instead of slippage-derived value
 */
export async function executePulseXSmartSwapToPLS(
  automationId: string,
  tokenIn: string,
  amount: bigint,
  slippage: number,
  recipient: string,
  getWallet: (id: string) => Promise<Wallet>,
  getEthersProvider: () => JsonRpcProvider,
  amountOutMinOverride?: bigint,
): Promise<ContractTransactionReceipt> {
  const wallet = await getWallet(automationId);
  const provider = getEthersProvider();
  const connectedWallet = wallet.provider ? wallet : wallet.connect(provider);

  const best = await findBestPath(tokenIn, WPLS_ADDRESS, amount);

  const amountOutMin =
    amountOutMinOverride ??
    (best.amountOut * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;

  // Approve input token to Smart Router
  const tokenContract = new Contract(tokenIn, erc20ABI, connectedWallet);
  const allowance: bigint = await tokenContract.allowance(
    wallet.address,
    PULSEX_SWAP_ROUTER,
  );
  if (allowance < amount) {
    const approveTx = await tokenContract.approve(
      PULSEX_SWAP_ROUTER,
      MaxUint256,
    );
    await approveTx.wait();
  }

  const smartRouter = new Contract(
    PULSEX_SWAP_ROUTER,
    PulseXSwapRouterABI,
    connectedWallet,
  );

  // Swap to WPLS, send output to router. Then unwrap to native PLS for recipient.
  const swapCalldata = smartRouter.interface.encodeFunctionData(
    "swapExactTokensForTokensV2",
    [amount, amountOutMin, best.path, PULSEX_SWAP_ROUTER],
  );
  const unwrapCalldata = smartRouter.interface.encodeFunctionData(
    "unwrapWETH9",
    [amountOutMin, recipient],
  );

  const tx = await smartRouter.multicall([swapCalldata, unwrapCalldata]);
  const receipt = await tx.wait();
  if (!receipt)
    throw new Error("PulseX SmartRouter swap-to-PLS transaction receipt is null");
  return receipt as ContractTransactionReceipt;
}
