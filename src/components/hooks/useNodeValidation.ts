import { useState, useEffect } from 'react';
import { isAddress } from 'ethers';
import type { NodeType } from '@/components/select-node-dialog';

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

  useEffect(() => {
    if (!nodeType) {
      setValidation({ hardErrors: {}, softWarnings: {}, isValid: true, isLoading: false });
      return;
    }

    const hardErrors: Record<string, string> = {};
    const softWarnings: Record<string, string> = {};

    // Client-side validation (format checks)
    const validateAddressFormat = (address: string | null | undefined, fieldName: string): boolean => {
      if (!address) return true; // Empty is handled by required checks
      if (!isAddress(address)) {
        hardErrors[fieldName] = 'Invalid address format';
        return false;
      }
      return true;
    };

    const validateNumberRange = (
      value: number | string | undefined,
      fieldName: string,
      min: number,
      max: number,
      allowEmpty = false
    ): boolean => {
      if (value === undefined || value === '' || value === null) {
        if (allowEmpty) return true;
        return true; // Empty handled by required checks
      }
      const num = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(num) || num < min || num > max) {
        hardErrors[fieldName] = `Must be between ${min} and ${max}`;
        return false;
      }
      return true;
    };

    // Validate based on node type
    switch (nodeType) {
      case 'swap':
      case 'swapFromPLS':
      case 'swapToPLS': {
        const path = formData.path || [];
        if (path.length === 0) {
          hardErrors.path = 'Token path cannot be empty';
        }
        path.forEach((addr: string, index: number) => {
          if (addr) {
            validateAddressFormat(addr, `path[${index}]`);
          }
        });
        validateNumberRange(formData.slippage, 'slippage', 0, 1, true);
        if (formData.slippage !== undefined && formData.slippage > 0.5) {
          softWarnings.slippage = 'Slippage is very high, you may receive significantly less than expected';
        }
        break;
      }

      case 'transfer': {
        if (!formData.token) {
          hardErrors.token = 'Token address is required';
        } else {
          validateAddressFormat(formData.token, 'token');
        }
        if (!formData.to) {
          hardErrors.to = 'Recipient address is required';
        } else {
          validateAddressFormat(formData.to, 'to');
        }
        const amount = formData.amount;
        if (amount && typeof amount === 'object' && amount.type === 'custom' && amount.value) {
          const numValue = parseFloat(amount.value);
          if (numValue === 0) {
            softWarnings.amount = 'Amount is 0, this node may not execute as expected';
          }
        }
        break;
      }

      case 'transferPLS': {
        if (!formData.to) {
          hardErrors.to = 'Recipient address is required';
        } else {
          validateAddressFormat(formData.to, 'to');
        }
        const plsAmount = formData.plsAmount;
        if (plsAmount && typeof plsAmount === 'object' && plsAmount.type === 'custom' && plsAmount.value) {
          const numValue = parseFloat(plsAmount.value);
          if (numValue === 0) {
            softWarnings.plsAmount = 'Amount is 0, this node may not execute as expected';
          }
        }
        break;
      }

      case 'addLiquidity': {
        if (!formData.tokenA) {
          hardErrors.tokenA = 'Token A address is required';
        } else {
          validateAddressFormat(formData.tokenA, 'tokenA');
        }
        if (!formData.tokenB) {
          hardErrors.tokenB = 'Token B address is required';
        } else {
          validateAddressFormat(formData.tokenB, 'tokenB');
        }
        validateNumberRange(formData.slippage, 'slippage', 0, 1, true);
        if (formData.slippage !== undefined && formData.slippage > 0.5) {
          softWarnings.slippage = 'Slippage is very high, you may receive significantly less than expected';
        }
        break;
      }

      case 'addLiquidityPLS': {
        if (!formData.token) {
          hardErrors.token = 'Token address is required';
        } else {
          validateAddressFormat(formData.token, 'token');
        }
        validateNumberRange(formData.slippage, 'slippage', 0, 1, true);
        if (formData.slippage !== undefined && formData.slippage > 0.5) {
          softWarnings.slippage = 'Slippage is very high, you may receive significantly less than expected';
        }
        break;
      }

      case 'removeLiquidity': {
        if (!formData.tokenA) {
          hardErrors.tokenA = 'Token A address is required';
        } else {
          validateAddressFormat(formData.tokenA, 'tokenA');
        }
        if (!formData.tokenB) {
          hardErrors.tokenB = 'Token B address is required';
        } else {
          validateAddressFormat(formData.tokenB, 'tokenB');
        }
        validateNumberRange(formData.slippage, 'slippage', 0, 1, true);
        if (formData.slippage !== undefined && formData.slippage > 0.5) {
          softWarnings.slippage = 'Slippage is very high, you may receive significantly less than expected';
        }
        break;
      }

      case 'removeLiquidityPLS': {
        if (!formData.token) {
          hardErrors.token = 'Token address is required';
        } else {
          validateAddressFormat(formData.token, 'token');
        }
        validateNumberRange(formData.slippage, 'slippage', 0, 1, true);
        if (formData.slippage !== undefined && formData.slippage > 0.5) {
          softWarnings.slippage = 'Slippage is very high, you may receive significantly less than expected';
        }
        break;
      }

      case 'burnToken':
      case 'claimToken': {
        if (!formData.token) {
          hardErrors.token = 'Token address is required';
        } else {
          validateAddressFormat(formData.token, 'token');
        }
        break;
      }

      case 'checkTokenBalance': {
        if (!formData.token) {
          hardErrors.token = 'Token address is required';
        } else {
          validateAddressFormat(formData.token, 'token');
        }
        break;
      }

      case 'checkLPTokenAmounts': {
        if (!formData.pairAddress) {
          hardErrors.pairAddress = 'Pair address is required';
        } else {
          validateAddressFormat(formData.pairAddress, 'pairAddress');
        }
        break;
      }

      case 'condition': {
        if (formData.conditionType === 'tokenBalance' && formData.tokenAddress) {
          validateAddressFormat(formData.tokenAddress, 'tokenAddress');
        }
        if (formData.conditionType === 'lpAmount' && formData.lpPairAddress) {
          validateAddressFormat(formData.lpPairAddress, 'lpPairAddress');
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
          } else if (num > 1000) {
            softWarnings.maxGasPrice = 'Gas price is very high, transaction may be expensive';
          }
        }
        break;
      }

      case 'loop': {
        validateNumberRange(formData.loopCount, 'loopCount', 1, 3);
        if (formData.loopCount === 3) {
          softWarnings.loopCount = 'Maximum loop count reached';
        }
        break;
      }

      case 'wait': {
        validateNumberRange(formData.delay, 'delay', 1, 10);
        if (formData.delay === 10) {
          softWarnings.delay = 'Maximum delay reached';
        }
        break;
      }
    }

    // Set initial client-side validation
    const isValid = Object.keys(hardErrors).length === 0;
    setValidation({
      hardErrors,
      softWarnings,
      isValid,
      isLoading: false,
    });

    // Then fetch server-side validation (balance checks, contract verification)
    // Debounce server-side validation to avoid excessive API calls
    let timeoutId: NodeJS.Timeout | null = null;
    if (isValid && Object.keys(formData).length > 0) {
      timeoutId = setTimeout(() => {
        setValidation((prev) => ({ ...prev, isLoading: true }));

        fetch(`/api/automations/${automationId}/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeType, formData }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.hardErrors || data.softWarnings) {
              setValidation({
                hardErrors: { ...hardErrors, ...(data.hardErrors || {}) },
                softWarnings: { ...softWarnings, ...(data.softWarnings || {}) },
                isValid: Object.keys({ ...hardErrors, ...(data.hardErrors || {}) }).length === 0,
                isLoading: false,
              });
            } else {
              setValidation((prev) => ({ ...prev, isLoading: false }));
            }
          })
          .catch((error) => {
            console.error('Validation error:', error);
            setValidation((prev) => ({ ...prev, isLoading: false }));
          });
      }, 500);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [formData, nodeType, automationId]);

  return validation;
}
