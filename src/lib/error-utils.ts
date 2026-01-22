export type ErrorType = 'network' | 'blockchain' | 'config' | 'unknown';

export interface ParsedError {
  userMessage: string;
  technicalDetails: string;
  errorType: ErrorType;
  isRetryable: boolean;
}

const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  userMessage: string;
  errorType: ErrorType;
  isRetryable: boolean;
}> = [
    // Network/RPC errors
    {
      pattern: /504 Gateway|502 Bad Gateway|503 Service/i,
      userMessage: 'RPC server is temporarily unavailable. Try again in a moment.',
      errorType: 'network',
      isRetryable: true,
    },
    {
      pattern: /ETIMEDOUT|ECONNREFUSED|ENOTFOUND|timeout|timed out/i,
      userMessage: 'Request timed out. The network may be congested.',
      errorType: 'network',
      isRetryable: true,
    },
    {
      pattern: /rate limit|429|too many requests/i,
      userMessage: 'Too many requests. Please wait and try again.',
      errorType: 'network',
      isRetryable: true,
    },
    {
      pattern: /network error|fetch failed|failed to fetch/i,
      userMessage: 'Network connection failed. Check your internet connection.',
      errorType: 'network',
      isRetryable: true,
    },
    // Blockchain errors
    {
      pattern: /insufficient funds/i,
      userMessage: 'Wallet has insufficient funds for this transaction.',
      errorType: 'blockchain',
      isRetryable: false,
    },
    {
      pattern: /gas required exceeds|exceeds block gas limit/i,
      userMessage: 'Transaction would fail - gas estimation exceeded.',
      errorType: 'blockchain',
      isRetryable: false,
    },
    {
      pattern: /nonce too low|nonce has already been used/i,
      userMessage: 'Transaction conflict - nonce already used. Try again.',
      errorType: 'blockchain',
      isRetryable: true,
    },
    {
      pattern: /execution reverted|revert|CALL_EXCEPTION/i,
      userMessage: 'Transaction would revert - check your parameters.',
      errorType: 'blockchain',
      isRetryable: false,
    },
    {
      pattern: /user rejected|user denied/i,
      userMessage: 'Transaction was rejected.',
      errorType: 'blockchain',
      isRetryable: false,
    },
    {
      pattern: /replacement.*underpriced/i,
      userMessage: 'Gas price too low for replacement transaction.',
      errorType: 'blockchain',
      isRetryable: true,
    },
    // Config errors
    {
      pattern: /not found|does not exist/i,
      userMessage: 'Resource not found. Check your configuration.',
      errorType: 'config',
      isRetryable: false,
    },
    {
      pattern: /invalid address|invalid token/i,
      userMessage: 'Invalid address provided. Check your configuration.',
      errorType: 'config',
      isRetryable: false,
    },
  ];

export function parseBlockchainError(error: unknown): ParsedError {
  const errorString = error instanceof Error ? error.message : String(error);

  for (const { pattern, userMessage, errorType, isRetryable } of ERROR_PATTERNS) {
    if (pattern.test(errorString)) {
      return {
        userMessage,
        technicalDetails: errorString,
        errorType,
        isRetryable,
      };
    }
  }

  // Unknown error - return a generic message but preserve details
  return {
    userMessage: 'An unexpected error occurred.',
    technicalDetails: errorString,
    errorType: 'unknown',
    isRetryable: false,
  };
}
