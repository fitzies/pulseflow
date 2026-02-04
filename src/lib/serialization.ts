export type JsonLike =
  | null
  | boolean
  | number
  | string
  | JsonLike[]
  | { [key: string]: JsonLike };

function isReceiptLike(value: unknown): value is {
  hash: string;
  blockNumber: unknown;
  blockHash?: unknown;
  transactionIndex?: unknown;
  from?: unknown;
  to?: unknown;
  status?: unknown;
  gasUsed?: unknown;
  gasPrice?: unknown;
  effectiveGasPrice?: unknown;
} {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return typeof v.hash === 'string' && v.blockNumber !== undefined;
}

function stringifyBigint(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

/**
 * Serialize any value into JSON-safe data for:
 * - DB storage (Prisma Json fields)
 * - SSE payloads
 * - Debug UI
 */
export function serializeForJson(value: unknown): JsonLike {
  if (value === undefined) return null;
  if (value === null) return null;

  // Summarize transaction receipts (prevents circular/provider objects, keeps hash)
  if (isReceiptLike(value)) {
    const r = value as any;
    return {
      hash: r.hash ?? null,
      blockHash: r.blockHash ?? null,
      blockNumber: r.blockNumber?.toString?.() ?? String(r.blockNumber),
      transactionIndex: r.transactionIndex ?? null,
      from: r.from ?? null,
      to: r.to ?? null,
      status: r.status ?? null,
      gasUsed: r.gasUsed?.toString?.() ?? null,
      gasPrice: r.gasPrice?.toString?.() ?? null,
      effectiveGasPrice: r.effectiveGasPrice?.toString?.() ?? null,
    };
  }

  try {
    return JSON.parse(
      JSON.stringify(value, (_k, v) => {
        if (v === undefined) return null;
        return stringifyBigint(v);
      })
    ) as JsonLike;
  } catch {
    return { unserializable: true } as unknown as JsonLike;
  }
}

