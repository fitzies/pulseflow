'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AmountValue } from '@/lib/execution-context';
import { getNumericOutputFields } from '@/lib/node-outputs';
import { WPLS } from '@/lib/abis';

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
}: AmountSelectorProps) {
  // For PLS amounts, check if previous node outputs PLS
  const previousOutputIsPLS = (() => {
    if (!isPLSAmount || !previousNodeType) return false;
    
    // swapPLS always outputs PLS
    if (previousNodeType === 'swapPLS') return true;
    
    // removeLiquidityPLS outputs amountPLS
    if (previousNodeType === 'removeLiquidityPLS') return true;
    
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
  const hasValidLPConfig = canUseLPRatio && 
    formData[lpRatioConfig.baseTokenField] && 
    (lpRatioConfig.isPLS || formData[lpRatioConfig.pairedTokenField]);

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

  const [customPercentage, setCustomPercentage] = useState<string>(
    normalizedValue.type === 'previousOutput'
      ? normalizedValue.percentage.toString()
      : '100'
  );

  const handleModeChange = (mode: 'static' | 'previousOutput' | 'lpRatio') => {
    if (mode === 'static') {
      onChange({ type: 'static', value: '' });
    } else if (mode === 'lpRatio' && lpRatioConfig && formData) {
      const baseAmount = formData[lpRatioConfig.baseAmountField];
      onChange({
        type: 'lpRatio',
        baseToken: formData[lpRatioConfig.baseTokenField] || '',
        baseAmount: baseAmount || { type: 'static', value: '' },
        pairedToken: lpRatioConfig.isPLS ? 'PLS' : (formData[lpRatioConfig.pairedTokenField] || ''),
      });
    } else {
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
        value={normalizedValue.type}
        onValueChange={(value) =>
          handleModeChange(value as 'static' | 'previousOutput' | 'lpRatio')
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
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
              Auto from LP Ratio {!hasValidLPConfig ? '(enter tokens first)' : ''}
            </SelectItem>
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

      {/* LP Ratio */}
      {normalizedValue.type === 'lpRatio' && (
        <p className="text-xs text-muted-foreground">
          Amount will be auto-calculated based on the current LP pool ratio to match the other token amount.
        </p>
      )}

    </div>
  );
}
