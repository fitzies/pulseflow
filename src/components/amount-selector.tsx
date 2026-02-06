'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select';
import type { AmountValue } from '@/lib/execution-context';
import { getNumericOutputFields } from '@/lib/node-outputs';
import { WPLS } from '@/lib/abis';
import type { Node } from '@xyflow/react';

interface LpQuoteState {
  loading: boolean;
  error: string | null;
  quotedAmount: string | null;
}

interface VariableInfo {
  id: string;
  name: string;
}

interface AmountSelectorProps {
  value: AmountValue | string | undefined;
  onChange: (value: AmountValue) => void;
  previousNodeType?: string | null;
  previousNodeConfig?: Record<string, any>; // Config from previous node
  label?: string;
  fieldName: string;
  nodeType?: string | null; // Current node type (for swap nodes to use path)
  formData?: Record<string, any>; // Full form data (to access path for swap nodes)
  isPLSAmount?: boolean; // Whether this is a PLS amount field
  // For LP ratio calculation
  lpRatioConfig?: {
    baseTokenField: string; // e.g., 'tokenA'
    baseAmountField: string; // e.g., 'amountADesired'
    pairedTokenField: string; // e.g., 'tokenB' or 'token' for PLS
    isPLS?: boolean; // If pairing with PLS
  };
  // All nodes in the flow (for extracting variables)
  nodes?: Node[];
}

export function AmountSelector({
  value,
  onChange,
  previousNodeType,
  previousNodeConfig = {},
  label = 'Amount',
  fieldName,
  nodeType,
  formData,
  isPLSAmount = false,
  lpRatioConfig,
  nodes = [],
}: AmountSelectorProps) {
  // Extract variable nodes from the flow
  const variableNodes: VariableInfo[] = nodes
    .filter((n) => n.type === 'variable' && (n.data as { config?: { variableName?: string } })?.config?.variableName)
    .map((n) => ({
      id: n.id,
      name: (n.data as { config?: { variableName?: string } })?.config?.variableName || '',
    }));
  // For PLS amounts, check if previous node outputs PLS
  const previousOutputIsPLS = (() => {
    if (!isPLSAmount || !previousNodeType) return false;
    
    // swapPLS always outputs PLS
    if (previousNodeType === 'swapPLS') return true;
    
    // swapToPLS always outputs PLS
    if (previousNodeType === 'swapToPLS') return true;
    
    // removeLiquidityPLS outputs amountPLS
    if (previousNodeType === 'removeLiquidityPLS') return true;
    
    // Calculator and variable nodes output generic values - allow for any amount
    if (previousNodeType === 'calculator' || previousNodeType === 'variable') return true;
    
    // For swap nodes, check if path ends with WPLS
    if (previousNodeType === 'swap') {
      const path = previousNodeConfig.path || [];
      return path.length > 0 && path[path.length - 1].toLowerCase() === WPLS.toLowerCase();
    }
    
    return false;
  })();
  
  // Get only numeric fields (exclude tokenOut, token, etc.)
  const availableFields = previousNodeType ? getNumericOutputFields(previousNodeType) : [];
  // Check if LP ratio option should be available
  const canUseLPRatio = !!lpRatioConfig && !!formData;
  const hasTokensForLPConfig =
    canUseLPRatio &&
    formData[lpRatioConfig.baseTokenField] &&
    (lpRatioConfig.isPLS || formData[lpRatioConfig.pairedTokenField]);

  const baseAmountConfig = canUseLPRatio ? formData[lpRatioConfig.baseAmountField] : undefined;
  const baseAmountIsLpRatio =
    !!baseAmountConfig &&
    typeof baseAmountConfig === 'object' &&
    'type' in baseAmountConfig &&
    (baseAmountConfig as any).type === 'lpRatio';

  const hasValidLPConfig = hasTokensForLPConfig && !baseAmountIsLpRatio;
  const lpRatioDisabledReason = !hasTokensForLPConfig
    ? '(enter tokens first)'
    : baseAmountIsLpRatio
      ? '(choose base amount first)'
      : '';

  // Normalize value to AmountValue type
  const normalizedValue: AmountValue = (() => {
    if (!value) {
      return { type: 'static', value: '' };
    }
    if (typeof value === 'string') {
      // Legacy string value - convert to static
      return { type: 'static', value };
    }
    return value;
  })();

  // Check if current value is a variable reference
  const isVariableValue = normalizedValue.type === 'variable';
  const selectedVariableName = isVariableValue ? (normalizedValue as { type: 'variable'; variableName: string }).variableName : null;

  const [customPercentage, setCustomPercentage] = useState<string>(
    normalizedValue.type === 'previousOutput'
      ? normalizedValue.percentage.toString()
      : '100'
  );

  // LP Quote preview state
  const [lpQuote, setLpQuote] = useState<LpQuoteState>({
    loading: false,
    error: null,
    quotedAmount: null,
  });

  // Extract base amount value from config
  const getBaseAmountValue = useCallback((): string | null => {
    if (!lpRatioConfig || !formData) return null;
    const baseConfig = formData[lpRatioConfig.baseAmountField];
    if (!baseConfig) return null;
    if (typeof baseConfig === 'string') return baseConfig;
    if (baseConfig.type === 'static' && baseConfig.value) {
      return baseConfig.value;
    }
    return null;
  }, [lpRatioConfig, formData]);

  // Fetch LP quote when lpRatio is selected
  useEffect(() => {
    if (normalizedValue.type !== 'lpRatio') {
      setLpQuote({ loading: false, error: null, quotedAmount: null });
      return;
    }

    if (!lpRatioConfig || !formData) return;

    const baseToken = formData[lpRatioConfig.baseTokenField];
    const pairedToken = lpRatioConfig.isPLS ? 'PLS' : formData[lpRatioConfig.pairedTokenField];
    const baseAmount = getBaseAmountValue();

    if (!baseToken || !pairedToken || !baseAmount) {
      setLpQuote({ loading: false, error: 'Enter base amount first', quotedAmount: null });
      return;
    }

    // Debounce the fetch
    const timeoutId = setTimeout(async () => {
      setLpQuote({ loading: true, error: null, quotedAmount: null });

      try {
        const response = await fetch('/api/lp-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseToken, pairedToken, baseAmount }),
        });

        const data = await response.json();

        if (!response.ok) {
          setLpQuote({ loading: false, error: data.error || 'Failed to fetch quote', quotedAmount: null });
          return;
        }

        setLpQuote({
          loading: false,
          error: null,
          quotedAmount: data.quotedAmountFormatted,
        });
      } catch (err) {
        setLpQuote({
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch quote',
          quotedAmount: null,
        });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [normalizedValue.type, lpRatioConfig, formData, getBaseAmountValue]);

  const handleModeChange = (mode: string) => {
    // Check if this is a variable selection (prefixed with 'var:')
    if (mode.startsWith('var:')) {
      const variableName = mode.slice(4);
      onChange({ type: 'variable', variableName } as AmountValue);
      return;
    }

    if (mode === 'static') {
      onChange({ type: 'static', value: '' });
    } else if (mode === 'lpRatio' && lpRatioConfig && formData) {
      if (baseAmountIsLpRatio) {
        return;
      }
      // Store field REFERENCES - will be resolved dynamically at execution time
      onChange({
        type: 'lpRatio',
        baseTokenField: lpRatioConfig.baseTokenField, // Field name, not value! Resolved at execution time
        baseAmountField: lpRatioConfig.baseAmountField, // Field name, not value!
        pairedToken: lpRatioConfig.isPLS ? 'PLS' : (formData[lpRatioConfig.pairedTokenField] || ''),
      });
    } else if (mode === 'previousOutput') {
      // Use numeric fields only
      const defaultField = availableFields[0] || 'amountOut';
      onChange({
        type: 'previousOutput',
        field: defaultField,
        percentage: parseFloat(customPercentage) || 100,
      });
    }
  };

  const handlePercentageChange = (percentage: number) => {
    if (normalizedValue.type === 'previousOutput') {
      onChange({
        ...normalizedValue,
        percentage,
      });
    }
    setCustomPercentage(percentage.toString());
  };

  const handleFieldChange = (field: string) => {
    if (normalizedValue.type === 'previousOutput') {
      onChange({
        ...normalizedValue,
        field,
      });
    }
  };

  return (
    <div className="grid gap-3">
      <label className="text-sm font-medium">{label}</label>
      
      {/* Mode Selector */}
      <Select
        value={isVariableValue ? `var:${selectedVariableName}` : normalizedValue.type}
        onValueChange={handleModeChange}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select source" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Source</SelectLabel>
            <SelectItem value="static">Custom Amount</SelectItem>
            <SelectItem 
              value="previousOutput" 
              disabled={
                !previousNodeType || 
                availableFields.length === 0 || 
                (isPLSAmount && !previousOutputIsPLS)
              }
            >
              Previous Output {
                !previousNodeType 
                  ? '(no previous node)' 
                  : availableFields.length === 0 
                    ? '(no outputs)' 
                    : isPLSAmount && !previousOutputIsPLS
                      ? '(previous output is not PLS)'
                      : ''
              }
            </SelectItem>
            {canUseLPRatio && (
              <SelectItem 
                value="lpRatio"
                disabled={!hasValidLPConfig}
              >
                Auto from LP Ratio {!hasValidLPConfig ? lpRatioDisabledReason : ''}
              </SelectItem>
            )}
          </SelectGroup>
          {variableNodes.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Variables</SelectLabel>
                {variableNodes.map((v) => (
                  <SelectItem key={v.id} value={`var:${v.name}`}>
                    ${v.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}
        </SelectContent>
      </Select>

      {/* Static Input */}
      {normalizedValue.type === 'static' && (
        <>
          <Input
            type="number"
            step="any"
            placeholder="0"
            value={normalizedValue.value}
            onChange={(e) => onChange({ type: 'static', value: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Enter amount</p>
        </>
      )}

      {/* Previous Output */}
      {normalizedValue.type === 'previousOutput' && (
        <div className="space-y-3">
          {previousNodeType && availableFields.length > 0 && (
            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground">Output Field</label>
              <Select
                value={normalizedValue.field}
                onValueChange={handleFieldChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map((field) => (
                    <SelectItem key={field} value={field}>
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Will use: {normalizedValue.field} from previous {previousNodeType}
              </p>
            </div>
          )}
          
          <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">Percentage</label>
            <div className="flex gap-2">
              {[100, 75, 50, 25].map((pct) => (
                <Button
                  key={pct}
                  type="button"
                  variant={normalizedValue.percentage === pct ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePercentageChange(pct)}
                  className="flex-1"
                >
                  {pct}%
                </Button>
              ))}
            </div>
            <Input
              type="number"
              placeholder="Custom %"
              value={customPercentage}
              onChange={(e) => {
                const val = e.target.value;
                setCustomPercentage(val);
                const num = parseFloat(val);
                if (!isNaN(num) && num >= 0 && num <= 100) {
                  handlePercentageChange(num);
                }
              }}
              min="0"
              max="100"
            />
          </div>
        </div>
      )}

      {/* Variable */}
      {isVariableValue && selectedVariableName && (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-3">
          <p className="text-sm text-emerald-400">
            Will use the value of variable <span className="font-mono font-medium">${selectedVariableName}</span>
          </p>
        </div>
      )}

      {/* LP Ratio */}
      {normalizedValue.type === 'lpRatio' && (
        <div className="grid gap-2">
          {lpQuote.loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Calculating...
            </div>
          )}
          {lpQuote.error && (
            <p className="text-xs text-yellow-500">
              {lpQuote.error}
            </p>
          )}
          {lpQuote.quotedAmount && !lpQuote.loading && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Calculated amount:</p>
              <p className="text-lg font-semibold">
                ~{parseFloat(lpQuote.quotedAmount).toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Amount will be auto-calculated based on the current LP pool ratio to match the other token amount.
          </p>
          {baseAmountIsLpRatio && (
            <p className="text-xs text-yellow-500">
              LP Ratio can&apos;t be calculated from another LP Ratio amount. Switch one side to Custom Amount or Previous Output.
            </p>
          )}
        </div>
      )}

    </div>
  );
}
