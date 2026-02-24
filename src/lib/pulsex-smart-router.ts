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
}

/**
 * Build candidate paths and find the one with the best output.
 * Checks direct pair + 2-hop routes via each base token.
 */
export async function findBestPath(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
): Promise<CandidatePath> {
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
        const amounts: bigint[] = await router.getAmountsOut(amountIn, path);
        return { path, amountOut: amounts[amounts.length - 1] };
      } catch {
        return { path, amountOut: 0n };
      }
    }),
  );

  const best = quotes.reduce((a, b) => (b.amountOut > a.amountOut ? b : a));
  if (best.amountOut === 0n) {
    throw new Error("All PulseX V2 routes returned zero output");
  }

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
): Promise<ContractTransactionReceipt> {
  const wallet = await getWallet(automationId);
  const provider = getEthersProvider();
  const connectedWallet = wallet.provider ? wallet : wallet.connect(provider);

  const tokenInAddr =
    tokenIn.toUpperCase() === "PLS" ? WPLS_ADDRESS : tokenIn;
  const tokenOutAddr =
    tokenOut.toUpperCase() === "PLS" ? WPLS_ADDRESS : tokenOut;

  const best = await findBestPath(tokenInAddr, tokenOutAddr, amount);

  const amountOutMin =
    (best.amountOut * BigInt(Math.floor((1 - slippage) * 10000))) / 10000n;

  // Approve input token to Smart Router
  if (tokenIn.toUpperCase() !== "PLS") {
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
      amount,
      amountOutMin,
      best.path,
      to,
      { value: amount },
    );
  } else {
    tx = await smartRouter.swapExactTokensForTokensV2(
      amount,
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
