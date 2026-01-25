import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { JsonRpcProvider, Contract, isAddress } from 'ethers';
import { erc20ABI, pairABI, playgroundTokenABI } from '@/lib/abis';
import { CONFIG } from '@/lib/config';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: automationId } = await params;
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
    });

    if (!automation || automation.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    const body = await request.json();
    const { nodeType, formData } = body;

    const provider = new JsonRpcProvider(CONFIG.pulsechainRpc);
    const walletAddress = automation.walletAddress;

    const validationResults: {
      hardErrors: Record<string, string>;
      softWarnings: Record<string, string>;
    } = {
      hardErrors: {},
      softWarnings: {},
    };

    // Helper function to validate address format
    const validateAddress = (address: string): boolean => {
      return isAddress(address);
    };

    // Helper function to check if contract exists and implements name()
    const validateTokenContract = async (address: string): Promise<boolean> => {
      if (!validateAddress(address)) return false;
      try {
        const contract = new Contract(address, erc20ABI, provider);
        await contract.name();
        return true;
      } catch {
        return false;
      }
    };

    // Helper function to check if contract is an LP pair
    const validateLPPair = async (address: string): Promise<boolean> => {
      if (!validateAddress(address)) return false;
      try {
        const contract = new Contract(address, pairABI, provider);
        await contract.token0();
        await contract.token1();
        return true;
      } catch {
        return false;
      }
    };

    // Helper function to check if address is a token (not LP)
    const validateTokenOnly = async (address: string): Promise<{ isValid: boolean; isLP: boolean }> => {
      if (!validateAddress(address)) return { isValid: false, isLP: false };
      const isLP = await validateLPPair(address);
      if (isLP) return { isValid: false, isLP: true };
      const isValidToken = await validateTokenContract(address);
      return { isValid: isValidToken, isLP: false };
    };

    // Helper function to check if address is an LP pair (not token)
    const validateLPOnly = async (address: string): Promise<{ isValid: boolean; isToken: boolean }> => {
      if (!validateAddress(address)) return { isValid: false, isToken: false };
      const isValidToken = await validateTokenContract(address);
      if (isValidToken && !(await validateLPPair(address))) {
        return { isValid: false, isToken: true };
      }
      const isValidLP = await validateLPPair(address);
      return { isValid: isValidLP, isToken: isValidToken && !isValidLP };
    };

    // Helper function to check if token is a playground token (has parent() function)
    const validatePlaygroundToken = async (address: string): Promise<boolean> => {
      if (!validateAddress(address)) return false;
      try {
        const contract = new Contract(address, playgroundTokenABI, provider);
        await contract.parent();
        return true;
      } catch {
        return false;
      }
    };

    // Helper function to get token balance
    const getTokenBalance = async (tokenAddress: string): Promise<bigint> => {
      try {
        const contract = new Contract(tokenAddress, erc20ABI, provider);
        return await contract.balanceOf(walletAddress);
      } catch {
        return 0n;
      }
    };

    // Helper function to get PLS balance
    const getPLSBalance = async (): Promise<bigint> => {
      return await provider.getBalance(walletAddress);
    };

    // Helper function to get LP balance
    const getLPBalance = async (lpAddress: string): Promise<bigint> => {
      try {
        const contract = new Contract(lpAddress, erc20ABI, provider);
        return await contract.balanceOf(walletAddress);
      } catch {
        return 0n;
      }
    };

    // Validate based on node type
    switch (nodeType) {
      case 'swap':
      case 'swapFromPLS':
      case 'swapToPLS': {
        const path = formData.path || [];
        if (path.length === 0) {
          validationResults.hardErrors.path = 'Token path cannot be empty';
        }
        for (let i = 0; i < path.length; i++) {
          const addr = path[i];
          if (addr && !validateAddress(addr)) {
            validationResults.hardErrors[`path[${i}]`] = 'Invalid address format';
          } else if (addr) {
            const tokenCheck = await validateTokenOnly(addr);
            if (tokenCheck.isLP) {
              validationResults.hardErrors[`path[${i}]`] = 'LP pair address not allowed in token path';
            } else if (!tokenCheck.isValid) {
              validationResults.hardErrors[`path[${i}]`] = 'Invalid token contract';
            }
          }
        }
        const slippage = formData.slippage;
        if (slippage !== undefined && (slippage < 0 || slippage > 1)) {
          validationResults.hardErrors.slippage = 'Slippage must be between 0 and 1';
        } else if (slippage !== undefined && slippage > 0.5) {
          validationResults.softWarnings.slippage = 'Slippage is very high, you may receive significantly less than expected';
        }
        break;
      }

      case 'transfer': {
        const token = formData.token;
        if (!token) {
          validationResults.hardErrors.token = 'Token address is required';
        } else if (!validateAddress(token)) {
          validationResults.hardErrors.token = 'Invalid address format';
        } else {
          const tokenCheck = await validateTokenOnly(token);
          if (tokenCheck.isLP) {
            validationResults.hardErrors.token = 'LP pair address not allowed. Please use a token address.';
          } else if (!tokenCheck.isValid) {
            validationResults.hardErrors.token = 'Invalid token contract';
          }
        }
        const to = formData.to;
        if (!to) {
          validationResults.hardErrors.to = 'Recipient address is required';
        } else if (!validateAddress(to)) {
          validationResults.hardErrors.to = 'Invalid address format';
        }
        const amount = formData.amount;
        if (amount && typeof amount === 'object' && amount.type === 'custom' && amount.value) {
          const balance = await getTokenBalance(token);
          const amountBigInt = BigInt(Math.floor(parseFloat(amount.value) * 1e18));
          if (amountBigInt > balance) {
            validationResults.softWarnings.amount = 'You might not have enough tokens';
          }
          if (amountBigInt === 0n) {
            validationResults.softWarnings.amount = 'Amount is 0, this node may not execute as expected';
          }
        }
        break;
      }

      case 'transferPLS': {
        const to = formData.to;
        if (!to) {
          validationResults.hardErrors.to = 'Recipient address is required';
        } else if (!validateAddress(to)) {
          validationResults.hardErrors.to = 'Invalid address format';
        }
        const plsAmount = formData.plsAmount;
        if (plsAmount && typeof plsAmount === 'object' && plsAmount.type === 'custom' && plsAmount.value) {
          const balance = await getPLSBalance();
          const amountBigInt = BigInt(Math.floor(parseFloat(plsAmount.value) * 1e18));
          if (amountBigInt > balance) {
            validationResults.softWarnings.plsAmount = 'You might not have enough PLS';
          }
          if (amountBigInt === 0n) {
            validationResults.softWarnings.plsAmount = 'Amount is 0, this node may not execute as expected';
          }
        }
        break;
      }

      case 'addLiquidity': {
        const tokenA = formData.tokenA;
        if (!tokenA) {
          validationResults.hardErrors.tokenA = 'Token A address is required';
        } else if (!validateAddress(tokenA)) {
          validationResults.hardErrors.tokenA = 'Invalid address format';
        } else {
          const tokenCheck = await validateTokenOnly(tokenA);
          if (tokenCheck.isLP) {
            validationResults.hardErrors.tokenA = 'LP pair address not allowed. Please use a token address.';
          } else if (!tokenCheck.isValid) {
            validationResults.hardErrors.tokenA = 'Invalid token contract';
          }
        }
        const tokenB = formData.tokenB;
        if (!tokenB) {
          validationResults.hardErrors.tokenB = 'Token B address is required';
        } else if (!validateAddress(tokenB)) {
          validationResults.hardErrors.tokenB = 'Invalid address format';
        } else {
          const tokenCheck = await validateTokenOnly(tokenB);
          if (tokenCheck.isLP) {
            validationResults.hardErrors.tokenB = 'LP pair address not allowed. Please use a token address.';
          } else if (!tokenCheck.isValid) {
            validationResults.hardErrors.tokenB = 'Invalid token contract';
          }
        }
        const slippage = formData.slippage;
        if (slippage !== undefined && (slippage < 0 || slippage > 1)) {
          validationResults.hardErrors.slippage = 'Slippage must be between 0 and 1';
        } else if (slippage !== undefined && slippage > 0.5) {
          validationResults.softWarnings.slippage = 'Slippage is very high, you may receive significantly less than expected';
        }
        break;
      }

      case 'addLiquidityPLS': {
        const token = formData.token;
        if (!token) {
          validationResults.hardErrors.token = 'Token address is required';
        } else if (!validateAddress(token)) {
          validationResults.hardErrors.token = 'Invalid address format';
        } else {
          const tokenCheck = await validateTokenOnly(token);
          if (tokenCheck.isLP) {
            validationResults.hardErrors.token = 'LP pair address not allowed. Please use a token address.';
          } else if (!tokenCheck.isValid) {
            validationResults.hardErrors.token = 'Invalid token contract';
          }
        }
        const slippage = formData.slippage;
        if (slippage !== undefined && (slippage < 0 || slippage > 1)) {
          validationResults.hardErrors.slippage = 'Slippage must be between 0 and 1';
        } else if (slippage !== undefined && slippage > 0.5) {
          validationResults.softWarnings.slippage = 'Slippage is very high, you may receive significantly less than expected';
        }
        break;
      }

      case 'removeLiquidity': {
        const tokenA = formData.tokenA;
        if (!tokenA) {
          validationResults.hardErrors.tokenA = 'Token A address is required';
        } else if (!validateAddress(tokenA)) {
          validationResults.hardErrors.tokenA = 'Invalid address format';
        } else {
          const tokenCheck = await validateTokenOnly(tokenA);
          if (tokenCheck.isLP) {
            validationResults.hardErrors.tokenA = 'LP pair address not allowed. Please use a token address.';
          } else if (!tokenCheck.isValid) {
            validationResults.hardErrors.tokenA = 'Invalid token contract';
          }
        }
        const tokenB = formData.tokenB;
        if (!tokenB) {
          validationResults.hardErrors.tokenB = 'Token B address is required';
        } else if (!validateAddress(tokenB)) {
          validationResults.hardErrors.tokenB = 'Invalid address format';
        } else {
          const tokenCheck = await validateTokenOnly(tokenB);
          if (tokenCheck.isLP) {
            validationResults.hardErrors.tokenB = 'LP pair address not allowed. Please use a token address.';
          } else if (!tokenCheck.isValid) {
            validationResults.hardErrors.tokenB = 'Invalid token contract';
          }
        }
        break;
      }
      case 'removeLiquidityPLS': {
        const token = formData.token;
        if (!token) {
          validationResults.hardErrors.token = 'Token address is required';
        } else if (!validateAddress(token)) {
          validationResults.hardErrors.token = 'Invalid address format';
        } else {
          const tokenCheck = await validateTokenOnly(token);
          if (tokenCheck.isLP) {
            validationResults.hardErrors.token = 'LP pair address not allowed. Please use a token address.';
          } else if (!tokenCheck.isValid) {
            validationResults.hardErrors.token = 'Invalid token contract';
          }
        }
        const slippage = formData.slippage;
        if (slippage !== undefined && (slippage < 0 || slippage > 1)) {
          validationResults.hardErrors.slippage = 'Slippage must be between 0 and 1';
        } else if (slippage !== undefined && slippage > 0.5) {
          validationResults.softWarnings.slippage = 'Slippage is very high, you may receive significantly less than expected';
        }
        break;
      }

      case 'burnToken':
      case 'claimToken': {
        const token = formData.token;
        if (!token) {
          validationResults.hardErrors.token = 'Token address is required';
        } else if (!validateAddress(token)) {
          validationResults.hardErrors.token = 'Invalid address format';
        } else {
          const tokenCheck = await validateTokenOnly(token);
          if (tokenCheck.isLP) {
            validationResults.hardErrors.token = 'LP pair address not allowed. Please use a token address.';
          } else if (!tokenCheck.isValid) {
            validationResults.hardErrors.token = 'Invalid token contract';
          } else {
            // Check if it's a playground token (has parent() function)
            const isPlaygroundToken = await validatePlaygroundToken(token);
            if (!isPlaygroundToken) {
              validationResults.hardErrors.token = 'Only playground tokens are allowed. This token does not have a parent() function.';
            }
          }
        }
        break;
      }

      case 'checkTokenBalance': {
        const token = formData.token;
        if (!token) {
          validationResults.hardErrors.token = 'Token address is required';
        } else if (!validateAddress(token)) {
          validationResults.hardErrors.token = 'Invalid address format';
        } else {
          const tokenCheck = await validateTokenOnly(token);
          if (tokenCheck.isLP) {
            validationResults.hardErrors.token = 'LP pair address not allowed. Please use a token address.';
          } else if (!tokenCheck.isValid) {
            validationResults.hardErrors.token = 'Invalid token contract';
          }
        }
        break;
      }

      case 'checkLPTokenAmounts': {
        const pairAddress = formData.pairAddress;
        if (!pairAddress) {
          validationResults.hardErrors.pairAddress = 'Pair address is required';
        } else if (!validateAddress(pairAddress)) {
          validationResults.hardErrors.pairAddress = 'Invalid address format';
        } else {
          const lpCheck = await validateLPOnly(pairAddress);
          if (lpCheck.isToken) {
            validationResults.hardErrors.pairAddress = 'Token address not allowed. Please use an LP pair address.';
          } else if (!lpCheck.isValid) {
            validationResults.hardErrors.pairAddress = 'Invalid LP pair contract';
          }
        }
        break;
      }

      case 'condition': {
        const tokenAddress = formData.tokenAddress;
        if (tokenAddress && !validateAddress(tokenAddress)) {
          validationResults.hardErrors.tokenAddress = 'Invalid address format';
        } else if (tokenAddress) {
          const tokenCheck = await validateTokenOnly(tokenAddress);
          if (tokenCheck.isLP) {
            validationResults.hardErrors.tokenAddress = 'LP pair address not allowed. Please use a token address.';
          } else if (!tokenCheck.isValid) {
            validationResults.hardErrors.tokenAddress = 'Invalid token contract';
          }
        }
        const lpPairAddress = formData.lpPairAddress;
        if (lpPairAddress && !validateAddress(lpPairAddress)) {
          validationResults.hardErrors.lpPairAddress = 'Invalid address format';
        } else if (lpPairAddress) {
          const lpCheck = await validateLPOnly(lpPairAddress);
          if (lpCheck.isToken) {
            validationResults.hardErrors.lpPairAddress = 'Token address not allowed. Please use an LP pair address.';
          } else if (!lpCheck.isValid) {
            validationResults.hardErrors.lpPairAddress = 'Invalid LP pair contract';
          }
        }
        break;
      }

      case 'gasGuard': {
        const maxGasPrice = formData.maxGasPrice;
        if (maxGasPrice !== undefined && (isNaN(parseFloat(maxGasPrice)) || parseFloat(maxGasPrice) <= 0)) {
          validationResults.hardErrors.maxGasPrice = 'Gas price must be a positive number';
        } else if (maxGasPrice && parseFloat(maxGasPrice) > 10000000) {
          validationResults.softWarnings.maxGasPrice = 'Threshold is very high - gas guard may not trigger';
        }
        break;
      }

      case 'loop': {
        const loopCount = formData.loopCount;
        if (loopCount !== undefined && (loopCount < 1 || loopCount > 3)) {
          validationResults.hardErrors.loopCount = 'Loop count must be between 1 and 3';
        } else if (loopCount === 3) {
          validationResults.softWarnings.loopCount = 'Maximum loop count reached';
        }
        break;
      }

      case 'wait': {
        const delay = formData.delay;
        if (delay !== undefined && (delay < 1 || delay > 10)) {
          validationResults.hardErrors.delay = 'Delay must be between 1 and 10 seconds';
        } else if (delay === 10) {
          validationResults.softWarnings.delay = 'Maximum delay reached';
        }
        break;
      }
    }

    return NextResponse.json(validationResults);
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json(
      { error: 'Validation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
