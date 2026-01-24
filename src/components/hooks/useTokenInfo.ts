import { useState, useEffect } from 'react';
import { Contract, JsonRpcProvider, isAddress } from 'ethers';
import { erc20ABI, pairABI } from '@/lib/abis';
import { CONFIG } from '@/lib/config';

interface TokenInfo {
  name: string | null;
  isLoading: boolean;
  error: string | null;
  isLP: boolean | null;
  isToken: boolean | null;
}

export function useTokenInfo(
  address: string | null | undefined,
  expectedType?: 'token' | 'lp'
): TokenInfo {
  const [info, setInfo] = useState<TokenInfo>({
    name: null,
    isLoading: false,
    error: null,
    isLP: null,
    isToken: null,
  });

  useEffect(() => {
    if (!address || !isAddress(address)) {
      setInfo({ name: null, isLoading: false, error: null, isLP: null, isToken: null });
      return;
    }

    const provider = new JsonRpcProvider(CONFIG.pulsechainRpc);
    let cancelled = false;

    const fetchTokenInfo = async () => {
      // Reset ALL fields when starting a new fetch to prevent stale data
      setInfo({ name: null, isLoading: true, error: null, isLP: null, isToken: null });

      try {
        let isLP = false;
        let isToken = false;

        // First try as LP pair
        try {
          const pairContract = new Contract(address, pairABI, provider);
          const [token0, token1] = await Promise.all([
            pairContract.token0(),
            pairContract.token1(),
          ]);

          // Fetch names for both tokens
          const token0Contract = new Contract(token0, erc20ABI, provider);
          const token1Contract = new Contract(token1, erc20ABI, provider);

          const [token0Name, token1Name] = await Promise.all([
            token0Contract.name(),
            token1Contract.name(),
          ]);

          isLP = true;

          if (!cancelled) {
            setInfo({
              name: `${token0Name}/${token1Name}`,
              isLoading: false,
              error: null,
              isLP: true,
              isToken: false,
            });
          }
          return;
        } catch {
          // Not an LP pair, try as regular token
        }

        // Try as regular ERC20 token
        const tokenContract = new Contract(address, erc20ABI, provider);
        const name = await tokenContract.name();
        isToken = true;

        if (!cancelled) {
          setInfo({
            name,
            isLoading: false,
            error: null,
            isLP: false,
            isToken: true,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setInfo({
            name: null,
            isLoading: false,
            error: 'Failed to fetch token info',
            isLP: null,
            isToken: null,
          });
        }
      }
    };

    // Debounce the fetch
    const timeoutId = setTimeout(fetchTokenInfo, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [address, expectedType]);

  return info;
}
