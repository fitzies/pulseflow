'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Contract, JsonRpcProvider, isAddress } from 'ethers';
import { erc20ABI, pairABI } from '@/lib/abis';
import { CONFIG } from '@/lib/config';
import { ArrowPathRoundedSquareIcon } from '@heroicons/react/24/solid';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';

const FOREACH_ITEM_SENTINEL = '__FOREACH_ITEM__';

// ── Default token list ──────────────────────────────────────────────
const DEFAULT_TOKENS: TokenEntry[] = [
  { name: 'Mandala', symbol: 'MDALA', address: '0x3a6c545c9E07e6d3041DC802033400F7fBf96c9a' },
  { name: 'Matrix Oracle', symbol: 'MXORA', address: '0xf75C854109Dadb1dcaa09d3fE1f9cA6D35942940' },
  { name: 'ZeroTrust', symbol: 'ZERØ', address: '0xf6703DBff070F231eEd966D33B1B6D7eF5207d26' },
  { name: 'Domeshot', symbol: 'DOME', address: '0x23c9945687c49eB8E65A2Fd690E1D92fD0c3efE7' },
  { name: 'Ensu', symbol: 'ENSU', address: '0xb27DB93725523219a8B49168550eAb660B4c3Aa9' },
];

// ── Types ───────────────────────────────────────────────────────────
export interface TokenEntry {
  name: string;
  symbol: string;
  address: string;
}

interface TokenCommandInputProps {
  value: string;
  onChange: (address: string) => void;
  expectedType?: 'token' | 'lp';
  placeholder?: string;
  className?: string;
  allowForEachItem?: boolean;
}

// ── localStorage helpers ────────────────────────────────────────────
const STORAGE_KEY_TOKENS = 'pulseflow-recent-tokens';
const STORAGE_KEY_LPS = 'pulseflow-recent-lps';
const MAX_RECENT = 20;

function getStorageKey(expectedType?: 'token' | 'lp') {
  return expectedType === 'lp' ? STORAGE_KEY_LPS : STORAGE_KEY_TOKENS;
}

function getRecentItems(expectedType?: 'token' | 'lp'): TokenEntry[] {
  try {
    const raw = localStorage.getItem(getStorageKey(expectedType));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentItem(entry: TokenEntry, expectedType?: 'token' | 'lp') {
  try {
    const items = getRecentItems(expectedType);
    const filtered = items.filter(
      (i) => i.address.toLowerCase() !== entry.address.toLowerCase()
    );
    const updated = [entry, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(getStorageKey(expectedType), JSON.stringify(updated));
  } catch {
    // localStorage not available
  }
}

// ── On-chain lookup (non-hook, for use inside callbacks) ────────────
async function lookupAddress(
  address: string
): Promise<TokenEntry | null> {
  const provider = new JsonRpcProvider(CONFIG.pulsechainRpc);

  // Try as LP pair first
  try {
    const pairContract = new Contract(address, pairABI, provider);
    const [token0, token1] = await Promise.all([
      pairContract.token0(),
      pairContract.token1(),
    ]);
    const t0 = new Contract(token0, erc20ABI, provider);
    const t1 = new Contract(token1, erc20ABI, provider);
    const [t0Name, t1Name] = await Promise.all([t0.name(), t1.name()]);
    return { name: `${t0Name}/${t1Name}`, symbol: 'LP', address };
  } catch {
    // not an LP
  }

  // Try as regular ERC20
  try {
    const token = new Contract(address, erc20ABI, provider);
    const [name, symbol] = await Promise.all([token.name(), token.symbol()]);
    return { name, symbol, address };
  } catch {
    return null;
  }
}

// ── Truncate address for display ────────────────────────────────────
function truncateAddress(addr: string) {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ── Component ───────────────────────────────────────────────────────
export function TokenCommandInput({
  value,
  onChange,
  expectedType,
  placeholder,
  className = '',
  allowForEachItem,
}: TokenCommandInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [recentItems, setRecentItems] = useState<TokenEntry[]>([]);
  const [lookupResult, setLookupResult] = useState<TokenEntry | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupCancelledRef = useRef(false);

  const isForEachItem = value === FOREACH_ITEM_SENTINEL;

  // Resolve display name for the current value on mount / value change
  useEffect(() => {
    if (!value || isForEachItem) {
      setDisplayName(null);
      return;
    }

    // Check defaults first
    const fromDefault = DEFAULT_TOKENS.find(
      (t) => t.address.toLowerCase() === value.toLowerCase()
    );
    if (fromDefault) {
      setDisplayName(`${fromDefault.name} (${fromDefault.symbol})`);
      return;
    }

    // Check recent items
    const allRecent = getRecentItems(expectedType);
    const fromRecent = allRecent.find(
      (t) => t.address.toLowerCase() === value.toLowerCase()
    );
    if (fromRecent) {
      setDisplayName(`${fromRecent.name} (${fromRecent.symbol})`);
      return;
    }

    // If it's a valid address, do an on-chain lookup
    if (isAddress(value)) {
      let cancelled = false;
      setDisplayName(null);
      lookupAddress(value).then((result) => {
        if (!cancelled && result) {
          setDisplayName(`${result.name} (${result.symbol})`);
          // Also save it to recent so it's cached for next time
          saveRecentItem(result, expectedType);
        }
      });
      return () => { cancelled = true; };
    }

    setDisplayName(null);
  }, [value, expectedType, isForEachItem]);

  // Load recent items when dialog opens
  const handleOpen = useCallback(() => {
    setRecentItems(getRecentItems(expectedType));
    setSearch('');
    setLookupResult(null);
    setLookupLoading(false);
    setOpen(true);
  }, [expectedType]);

  // Debounced on-chain lookup when search is a full address
  useEffect(() => {
    if (!open) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    lookupCancelledRef.current = true; // cancel any in-flight lookup

    const trimmed = search.trim();
    if (trimmed.length === 42 && /^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setLookupLoading(true);
      lookupCancelledRef.current = false;
      const cancelledRef = lookupCancelledRef;

      debounceRef.current = setTimeout(() => {
        lookupAddress(trimmed).then((result) => {
          if (!cancelledRef.current) {
            setLookupResult(result);
            setLookupLoading(false);
          }
        });
      }, 500);
    } else {
      setLookupResult(null);
      setLookupLoading(false);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, open]);

  const handleSelect = useCallback(
    (entry: TokenEntry) => {
      onChange(entry.address);
      saveRecentItem(entry, expectedType);
      setRecentItems((prev) => {
        const filtered = prev.filter(
          (i) => i.address.toLowerCase() !== entry.address.toLowerCase()
        );
        return [entry, ...filtered].slice(0, MAX_RECENT);
      });
      setOpen(false);
    },
    [onChange, expectedType]
  );

  const handleForEachSelect = useCallback(() => {
    onChange(FOREACH_ITEM_SENTINEL);
    setOpen(false);
  }, [onChange]);

  // Determine which default tokens to show (only for token type or unset)
  const showDefaults = expectedType !== 'lp';

  // Filter out defaults that already appear in recent (by address)
  const recentAddresses = new Set(recentItems.map((r) => r.address.toLowerCase()));
  const filteredDefaults = showDefaults
    ? DEFAULT_TOKENS.filter((t) => !recentAddresses.has(t.address.toLowerCase()))
    : [];

  // ── Render trigger ──────────────────────────────────────────────
  if (isForEachItem) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center gap-2 rounded-md border border-orange-500/50 bg-orange-500/10 px-3 py-2 text-sm text-orange-500 text-left cursor-pointer hover:bg-orange-500/15 transition-colors"
      >
        <ArrowPathRoundedSquareIcon className="h-4 w-4 shrink-0" />
        For-Each Item
      </button>
    );
  }

  const defaultPlaceholder = expectedType === 'lp' ? 'Select LP pair...' : 'Select token...';

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`flex w-full items-center rounded-md border bg-transparent px-3 py-2 text-sm text-left cursor-pointer hover:bg-accent transition-colors ${displayName ? 'text-foreground' : 'text-muted-foreground'
          } ${className}`}
      >
        {displayName || (value ? truncateAddress(value) : placeholder || defaultPlaceholder)}
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={expectedType === 'lp' ? 'Select LP Pair' : 'Select Token'}
        description={expectedType === 'lp' ? 'Search by name or paste an LP pair address' : 'Search by name or paste a token address'}
      >
        <CommandInput
          placeholder={expectedType === 'lp' ? 'Search name or paste LP address...' : 'Search name or paste token address...'}
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>
            {lookupLoading ? 'Looking up address...' : 'No results found.'}
          </CommandEmpty>

          {/* For-Each Item - always pinned at top */}
          {allowForEachItem && (
            <>
              <CommandGroup heading="For-Each">
                <CommandItem onSelect={handleForEachSelect} value="__foreach_item__">
                  <ArrowPathRoundedSquareIcon className="h-4 w-4 text-orange-500" />
                  <span className="text-orange-500 font-medium">Use For-Each Item</span>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Lookup result from on-chain */}
          {lookupResult && (
            <CommandGroup heading="Lookup Result">
              <CommandItem
                onSelect={() => handleSelect(lookupResult)}
                value={`${lookupResult.name} ${lookupResult.symbol} ${lookupResult.address}`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{lookupResult.symbol}</span>
                  <span className="text-xs text-muted-foreground">{lookupResult.name}</span>
                </div>
              </CommandItem>
            </CommandGroup>
          )}

          {lookupLoading && !lookupResult && (
            <CommandGroup heading="Lookup Result">
              <CommandItem disabled value="__loading__">
                <span className="text-muted-foreground">Looking up address...</span>
              </CommandItem>
            </CommandGroup>
          )}

          {/* Recent items */}
          {recentItems.length > 0 && (
            <CommandGroup heading="Recent">
              {recentItems.map((item) => (
                <CommandItem
                  key={item.address}
                  onSelect={() => handleSelect(item)}
                  value={`${item.name} ${item.symbol} ${item.address}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{item.symbol}</span>
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Default tokens */}
          {filteredDefaults.length > 0 && (
            <CommandGroup heading="Suggested">
              {filteredDefaults.map((item) => (
                <CommandItem
                  key={item.address}
                  onSelect={() => handleSelect(item)}
                  value={`${item.name} ${item.symbol} ${item.address}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{item.symbol}</span>
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
