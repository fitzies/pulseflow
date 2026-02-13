import { useState, useEffect, useRef } from 'react';
import { isAddress } from 'ethers';
import type { NodeType } from '@/components/select-node-dialog';

const FOREACH_ITEM_SENTINEL = '__FOREACH_ITEM__';

interface ValidationState {
  hardErrors: Record<string, string>;
  softWarnings: Record<string, string>;
  isValid: boolean;
  isLoading: boolean;
}

export function useNodeValidation(
  formData: Record<string, any>,
  nodeType: NodeType | null,
  automationId: string
): ValidationState {
  const [validation, setValidation] = useState<ValidationState>({
    hardErrors: {},
    softWarnings: {},
    isValid: true,
    isLoading: false,
  });

  // Track previous values to detect changes
  const prevValuesRef = useRef<Record<string, any>>({});

  // Helper functions
  const validateAddressFormat = (address: string | null | undefined, fieldName: string): boolean => {
    if (!address) return true;
    if (address === FOREACH_ITEM_SENTINEL) return true; // forEach sentinel is valid
    if (!isAddress(address)) {
      return false;
    }
    return true;
  };

  const validateNumberRange = (
    value: number | string | undefined,
    fieldName: string,
    min: number,
    max: number
  ): boolean => {
    if (value === undefined || value === '' || value === null) return true;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return !isNaN(num) && num >= min && num <= max;
  };

  // Effect 1: Client-side format validation (immediate) - runs when addresses/required fields change
  useEffect(() => {
    if (!nodeType) {
      setValidation((prev) => ({ ...prev, hardErrors: {}, softWarnings: {}, isValid: true }));
      return;
    }

    const hardErrors: Record<string, string> = {};
    const softWarnings: Record<string, string> = {};

    // Get relevant fields for this node type
    const relevantFields: string[] = [];
    switch (nodeType) {
      case 'swap':
      case 'swapFromPLS':
      case 'swapToPLS':
        relevantFields.push('path');
        break;
      case 'transfer':
        relevantFields.push('token', 'to');
        break;
      case 'transferPLS':
        relevantFields.push('to');
        break;
      case 'addLiquidity':
        relevantFields.push('tokenA', 'tokenB');
        break;
      case 'addLiquidityPLS':
        relevantFields.push('token');
        break;
      case 'removeLiquidity':
        relevantFields.push('tokenA', 'tokenB');
        break;
      case 'removeLiquidityPLS':
        relevantFields.push('token');
        break;
      case 'burnToken':
      case 'claimToken':
      case 'checkTokenBalance':
        relevantFields.push('token');
        break;
      case 'checkLPTokenAmounts':
        relevantFields.push('pairAddress');
        break;
      case 'condition':
        if (formData.conditionType === 'tokenBalance') relevantFields.push('tokenAddress');
        if (formData.conditionType === 'lpAmount') relevantFields.push('lpPairAddress');
        break;
      case 'gasGuard':
        relevantFields.push('maxGasPrice');
        break;
      case 'loop':
        relevantFields.push('loopCount');
        break;
      case 'wait':
        relevantFields.push('delay');
        break;
      case 'dexQuote':
        relevantFields.push('path');
        break;
      case 'forEach':
        relevantFields.push('items');
        break;
    }

    // Check if any relevant field changed
    const hasChanges = relevantFields.some(
      (field) => JSON.stringify(formData[field]) !== JSON.stringify(prevValuesRef.current[field])
    );

    if (!hasChanges && Object.keys(prevValuesRef.current).length > 0) {
      return; // No relevant changes, skip validation
    }

    // Validate addresses
    switch (nodeType) {
      case 'swap':
      case 'swapFromPLS':
      case 'swapToPLS':
      case 'dexQuote': {
        const path = formData.path || [];
        const minPathLength = (nodeType === 'swapFromPLS' || nodeType === 'swapToPLS') ? 1 : 2;
        if (path.length === 0) {
          hardErrors.path = 'Token path cannot be empty';
        } else if (path.length < minPathLength) {
          hardErrors.path = 'Token path must have at least 2 addresses';
        }
        path.forEach((addr: string, index: number) => {
          if (addr && !validateAddressFormat(addr, `path[${index}]`)) {
            hardErrors[`path[${index}]`] = 'Invalid address format';
          }
        });
        break;
      }

      case 'transfer': {
        if (!formData.token) {
          hardErrors.token = 'Token address is required';
        } else if (!validateAddressFormat(formData.token, 'token')) {
          hardErrors.token = 'Invalid address format';
        }
        if (!formData.to) {
          hardErrors.to = 'Recipient address is required';
        } else if (!validateAddressFormat(formData.to, 'to')) {
          hardErrors.to = 'Invalid address format';
        }
        break;
      }

      case 'transferPLS': {
        if (!formData.to) {
          hardErrors.to = 'Recipient address is required';
        } else if (!validateAddressFormat(formData.to, 'to')) {
          hardErrors.to = 'Invalid address format';
        }
        break;
      }

      case 'addLiquidity': {
        if (!formData.tokenA) {
          hardErrors.tokenA = 'Token A address is required';
        } else if (!validateAddressFormat(formData.tokenA, 'tokenA')) {
          hardErrors.tokenA = 'Invalid address format';
        }
        if (!formData.tokenB) {
          hardErrors.tokenB = 'Token B address is required';
        } else if (!validateAddressFormat(formData.tokenB, 'tokenB')) {
          hardErrors.tokenB = 'Invalid address format';
        }
        break;
      }

      case 'addLiquidityPLS': {
        if (!formData.token) {
          hardErrors.token = 'Token address is required';
        } else if (!validateAddressFormat(formData.token, 'token')) {
          hardErrors.token = 'Invalid address format';
        }
        break;
      }

      case 'removeLiquidity': {
        if (!formData.tokenA) {
          hardErrors.tokenA = 'Token A address is required';
        } else if (!validateAddressFormat(formData.tokenA, 'tokenA')) {
          hardErrors.tokenA = 'Invalid address format';
        }
        if (!formData.tokenB) {
          hardErrors.tokenB = 'Token B address is required';
        } else if (!validateAddressFormat(formData.tokenB, 'tokenB')) {
          hardErrors.tokenB = 'Invalid address format';
        }
        break;
      }

      case 'removeLiquidityPLS': {
        if (!formData.token) {
          hardErrors.token = 'Token address is required';
        } else if (!validateAddressFormat(formData.token, 'token')) {
          hardErrors.token = 'Invalid address format';
        }
        break;
      }

      case 'burnToken':
      case 'claimToken':
      case 'checkTokenBalance': {
        if (!formData.token) {
          hardErrors.token = 'Token address is required';
        } else if (!validateAddressFormat(formData.token, 'token')) {
          hardErrors.token = 'Invalid address format';
        }
        break;
      }

      case 'checkLPTokenAmounts': {
        if (!formData.pairAddress) {
          hardErrors.pairAddress = 'Pair address is required';
        } else if (!validateAddressFormat(formData.pairAddress, 'pairAddress')) {
          hardErrors.pairAddress = 'Invalid address format';
        }
        break;
      }

      case 'condition': {
        if (formData.conditionType === 'tokenBalance' && formData.tokenAddress) {
          if (!validateAddressFormat(formData.tokenAddress, 'tokenAddress')) {
            hardErrors.tokenAddress = 'Invalid address format';
          }
        }
        if (formData.conditionType === 'lpAmount' && formData.lpPairAddress) {
          if (!validateAddressFormat(formData.lpPairAddress, 'lpPairAddress')) {
            hardErrors.lpPairAddress = 'Invalid address format';
          }
        }
        break;
      }

      case 'gasGuard': {
        const maxGasPrice = formData.maxGasPrice;
        if (maxGasPrice === undefined || maxGasPrice === '' || maxGasPrice === null) {
          hardErrors.maxGasPrice = 'Gas price is required';
        } else {
          const num = typeof maxGasPrice === 'string' ? parseFloat(maxGasPrice) : maxGasPrice;
          if (isNaN(num) || num <= 0) {
            hardErrors.maxGasPrice = 'Gas price must be a positive number';
          }
        }
        break;
      }

      case 'loop': {
        if (!validateNumberRange(formData.loopCount, 'loopCount', 1, 10)) {
          hardErrors.loopCount = 'Loop count must be between 1 and 10';
        }
        break;
      }

      case 'forEach': {
        const items = formData.items || [];
        if (items.length === 0) {
          hardErrors.items = 'At least one address is required';
        } else if (items.length > 10) {
          hardErrors.items = 'Maximum 10 items allowed';
        }
        items.forEach((addr: string, index: number) => {
          if (addr && !validateAddressFormat(addr, `items[${index}]`)) {
            hardErrors[`items[${index}]`] = 'Invalid address format';
          }
        });
        if (items.length > 5 && !hardErrors.items) {
          softWarnings.items = 'More than 5 items may cause the automation to timeout';
        }
        break;
      }

      case 'wait': {
        if (!validateNumberRange(formData.delay, 'delay', 1, 10)) {
          hardErrors.delay = 'Delay must be between 1 and 10 seconds';
        }
        break;
      }
    }

    // Update validation state
    const isValid = Object.keys(hardErrors).length === 0;
    setValidation((prev) => ({
      ...prev,
      hardErrors,
      softWarnings: { ...prev.softWarnings, ...softWarnings },
      isValid,
    }));

    // Update previous values
    relevantFields.forEach((field) => {
      prevValuesRef.current[field] = formData[field];
    });
  }, [
    nodeType,
    formData.path,
    formData.token,
    formData.tokenA,
    formData.tokenB,
    formData.to,
    formData.pairAddress,
    formData.tokenAddress,
    formData.lpPairAddress,
    formData.conditionType,
    formData.maxGasPrice,
    formData.loopCount,
    formData.delay,
    formData.items,
  ]);

  // Effect 2: Slippage validation (immediate) - only when slippage changes
  useEffect(() => {
    if (!nodeType) return;

    const needsSlippage = [
      'swap',
      'swapFromPLS',
      'swapToPLS',
      'addLiquidity',
      'addLiquidityPLS',
      'removeLiquidity',
      'removeLiquidityPLS',
    ].includes(nodeType);

    if (!needsSlippage) return;

    const slippage = formData.slippage;
    const hardErrors: Record<string, string> = {};
    const softWarnings: Record<string, string> = {};

    if (slippage !== undefined && (slippage < 0 || slippage > 1)) {
      hardErrors.slippage = 'Slippage must be between 0 and 1';
    } else if (slippage !== undefined && slippage > 0.5) {
      softWarnings.slippage = 'Slippage is very high, you may receive significantly less than expected';
    }

    setValidation((prev) => ({
      ...prev,
      hardErrors: { ...prev.hardErrors, ...hardErrors },
      softWarnings: { ...prev.softWarnings, ...softWarnings },
      isValid: Object.keys({ ...prev.hardErrors, ...hardErrors }).length === 0,
    }));
  }, [nodeType, formData.slippage]);

  // Effect 3: Amount warnings (immediate) - only when amounts change
  useEffect(() => {
    if (!nodeType) return;

    const softWarnings: Record<string, string> = {};

    switch (nodeType) {
      case 'transfer': {
        const amount = formData.amount;
        if (amount && typeof amount === 'object' && amount.type === 'static' && amount.value) {
          const numValue = parseFloat(amount.value);
          if (numValue === 0) {
            softWarnings.amount = 'Amount is 0, this node may not execute as expected';
          }
        }
        break;
      }

      case 'transferPLS': {
        const plsAmount = formData.plsAmount;
        if (plsAmount && typeof plsAmount === 'object' && plsAmount.type === 'static' && plsAmount.value) {
          const numValue = parseFloat(plsAmount.value);
          if (numValue === 0) {
            softWarnings.plsAmount = 'Amount is 0, this node may not execute as expected';
          }
        }
        break;
      }

      case 'gasGuard': {
        const maxGasPrice = formData.maxGasPrice;
        if (maxGasPrice && parseFloat(maxGasPrice) > 10000000) {
          softWarnings.maxGasPrice = 'Threshold is very high - gas guard may not trigger';
        }
        break;
      }

      case 'loop': {
        if (formData.loopCount > 5) {
          softWarnings.loopCount = 'More than 5 repeats may cause the automation to timeout (max runtime: 10 minutes)';
        }
        break;
      }

      case 'wait': {
        if (formData.delay === 10) {
          softWarnings.delay = 'Maximum delay reached';
        }
        break;
      }
    }

    setValidation((prev) => ({
      ...prev,
      softWarnings: { ...prev.softWarnings, ...softWarnings },
    }));
  }, [
    nodeType,
    formData.amount,
    formData.plsAmount,
    formData.maxGasPrice,
    formData.loopCount,
    formData.delay,
  ]);

  // Effect 4: Server-side validation (debounced 2s) - only when addresses OR amounts change
  const serverValidationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!nodeType) return;

    // Determine which fields trigger server-side validation
    const serverValidationFields: string[] = [];
    switch (nodeType) {
      case 'swap':
      case 'swapFromPLS':
      case 'swapToPLS':
      case 'dexQuote':
        serverValidationFields.push('path');
        break;
      case 'transfer':
        serverValidationFields.push('token', 'amount', 'tokenType');
        break;
      case 'transferPLS':
        serverValidationFields.push('plsAmount');
        break;
      case 'addLiquidity':
        serverValidationFields.push('tokenA', 'tokenB');
        break;
      case 'addLiquidityPLS':
        serverValidationFields.push('token');
        break;
      case 'removeLiquidity':
        serverValidationFields.push('tokenA', 'tokenB');
        break;
      case 'removeLiquidityPLS':
        serverValidationFields.push('token');
        break;
      case 'burnToken':
      case 'claimToken':
      case 'checkTokenBalance':
        serverValidationFields.push('token');
        break;
      case 'checkLPTokenAmounts':
        serverValidationFields.push('pairAddress');
        break;
      case 'condition':
        if (formData.conditionType === 'tokenBalance') serverValidationFields.push('tokenAddress');
        if (formData.conditionType === 'lpAmount') serverValidationFields.push('lpPairAddress');
        break;
    }

    // Check if any server validation field changed
    const hasServerChanges = serverValidationFields.some(
      (field) => JSON.stringify(formData[field]) !== JSON.stringify(prevValuesRef.current[`server_${field}`])
    );

    if (!hasServerChanges) return;

    // Clear existing timeout
    if (serverValidationTimeoutRef.current) {
      clearTimeout(serverValidationTimeoutRef.current);
    }

    // Debounce server-side validation (2 seconds)
    serverValidationTimeoutRef.current = setTimeout(() => {
      // Check if client-side validation passed before making API call
      setValidation((current) => {
        if (!current.isValid) return current;
        return { ...current, isLoading: true };
      });

      // Make API call
      fetch(`/api/automations/${automationId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeType, formData }),
      })
        .then((res) => res.json())
        .then((data) => {
          setValidation((prev) => {
            if (!prev.isValid) return prev; // Still check in case validation state changed
            if (data.hardErrors || data.softWarnings) {
              return {
                ...prev,
                hardErrors: { ...prev.hardErrors, ...(data.hardErrors || {}) },
                softWarnings: { ...prev.softWarnings, ...(data.softWarnings || {}) },
                isValid: Object.keys({ ...prev.hardErrors, ...(data.hardErrors || {}) }).length === 0,
                isLoading: false,
              };
            }
            return { ...prev, isLoading: false };
          });
        })
        .catch((error) => {
          console.error('Validation error:', error);
          setValidation((prev) => ({ ...prev, isLoading: false }));
        });
    }, 2000);

    // Update previous values for server validation fields
    serverValidationFields.forEach((field) => {
      prevValuesRef.current[`server_${field}`] = formData[field];
    });

    return () => {
      if (serverValidationTimeoutRef.current) {
        clearTimeout(serverValidationTimeoutRef.current);
        serverValidationTimeoutRef.current = null;
      }
    };
  }, [
    nodeType,
    automationId,
    formData.path,
    formData.token,
    formData.tokenA,
    formData.tokenB,
    formData.amount,
    formData.plsAmount,
    formData.pairAddress,
    formData.tokenAddress,
    formData.lpPairAddress,
    formData.conditionType,
    formData.tokenType,
  ]);

  return validation;
}
