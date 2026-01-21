import { NextRequest, NextResponse } from 'next/server';
import { Contract, JsonRpcProvider, parseEther, formatUnits } from 'ethers';
import { CONFIG } from '@/lib/config';
import { pulsexRouterABI, pairABI } from '@/lib/abis';

const factoryABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseToken, pairedToken, baseAmount } = body;

    if (!baseToken || !pairedToken || !baseAmount) {
      return NextResponse.json(
        { error: 'Missing required fields: baseToken, pairedToken, baseAmount' },
        { status: 400 }
      );
    }

    const provider = new JsonRpcProvider(CONFIG.pulsechainRpc);
    const routerContract = new Contract(CONFIG.pulseXRouter, pulsexRouterABI, provider);

    // Determine actual paired token address (PLS = WPLS)
    const pairedTokenAddress = pairedToken === 'PLS' ? CONFIG.wpls : pairedToken;

    // Get factory and pair address
    const factoryAddress = await routerContract.factory();
    const factoryContract = new Contract(factoryAddress, factoryABI, provider);
    const pairAddress = await factoryContract.getPair(baseToken, pairedTokenAddress);

    if (!pairAddress || pairAddress === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json(
        { error: 'No LP exists between the specified tokens' },
        { status: 404 }
      );
    }

    // Get reserves from pair
    const pairContract = new Contract(pairAddress, pairABI, provider);
    const reserves = await pairContract.getReserves();
    const token0 = await pairContract.token0();

    // Determine which reserve is which
    // baseToken = the token address (what we're calculating the amount for)
    // pairedTokenAddress = WPLS or another token (what we know the amount of)
    const isBaseToken0 = token0.toLowerCase() === baseToken.toLowerCase();
    const reserveBaseToken = isBaseToken0 ? reserves[0] : reserves[1];
    const reservePairedToken = isBaseToken0 ? reserves[1] : reserves[0];

    // Get the decimals of the output token (baseToken - the one we're calculating)
    let outputDecimals = 18;
    try {
      const tokenContract = new Contract(baseToken, [
        "function decimals() view returns (uint8)"
      ], provider);
      const decimalsResult = await tokenContract.decimals();
      outputDecimals = Number(decimalsResult);
    } catch {
      outputDecimals = 18;
    }

    // Convert baseAmount to wei (this is the INPUT amount - e.g., PLS amount)
    const inputAmountWei = parseEther(baseAmount.toString());

    // Use quote to calculate the output amount
    // quote(inputAmount, inputReserve, outputReserve) = outputAmount
    // We know the pairedToken amount, we want the baseToken amount
    const quotedAmount = await routerContract.quote(inputAmountWei, reservePairedToken, reserveBaseToken);

    // Format using the correct decimals for the output token
    const quotedAmountFormatted = formatUnits(quotedAmount, outputDecimals);

    return NextResponse.json({
      quotedAmount: quotedAmount.toString(),
      quotedAmountFormatted,
      baseToken,
      pairedToken,
      baseAmount,
      pairAddress,
      outputDecimals: Number(outputDecimals),
    });
  } catch (error) {
    console.error('LP quote calculation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate LP quote' },
      { status: 500 }
    );
  }
}
