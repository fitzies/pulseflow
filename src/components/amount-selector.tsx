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
import { getNodeOutputFields } from '@/lib/node-outputs';

interface AmountSelectorProps {
  value: AmountValue | string | undefined;
  onChange: (value: AmountValue) => void;
  previousNodeType?: string | null;
  label?: string;
  fieldName: string;
  nodeType?: string | null; // Current node type (for swap nodes to use path)
  formData?: Record<string, any>; // Full form data (to access path for swap nodes)
}

export function AmountSelector({
  value,
  onChange,
  previousNodeType,
  label = 'Amount',
  fieldName,
  nodeType,
  formData,
}: AmountSelectorProps) {
  // For swap nodes, check if we have a path
  const isSwapNode = nodeType === 'swap' || nodeType === 'swapPLS';
  const swapPath = isSwapNode ? (formData?.path || []) : [];
  const firstTokenInPath = swapPath.length > 0 ? swapPath[0] : null;
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
    normalizedValue.type === 'previousOutput' || normalizedValue.type === 'currentBalance'
      ? normalizedValue.percentage.toString()
      : '100'
  );

  const handleModeChange = (mode: 'static' | 'previousOutput' | 'currentBalance') => {
    if (mode === 'static') {
      onChange({ type: 'static', value: '' });
    } else if (mode === 'previousOutput') {
      // Get available fields from previous node type
      const fields = previousNodeType ? getNodeOutputFields(previousNodeType) : [];
      const defaultField = fields[0] || 'amountOut';
      onChange({
        type: 'previousOutput',
        field: defaultField,
        percentage: parseFloat(customPercentage) || 100,
      });
    } else {
      // For swap nodes, use first token in path automatically
      // For other nodes, require token address (no empty PLS since PLS has separate nodes)
      const token = isSwapNode && firstTokenInPath ? firstTokenInPath : '';
      onChange({
        type: 'currentBalance',
        token,
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
    } else if (normalizedValue.type === 'currentBalance') {
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

  const availableFields = previousNodeType ? getNodeOutputFields(previousNodeType) : [];

  return (
    <div className="grid gap-3">
      <label className="text-sm font-medium">{label}</label>
      
      {/* Mode Selector */}
      <Select
        value={normalizedValue.type}
        onValueChange={(value) =>
          handleModeChange(value as 'static' | 'previousOutput' | 'currentBalance')
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="static">Custom Amount</SelectItem>
          <SelectItem value="previousOutput" disabled={!previousNodeType || availableFields.length === 0}>
            Previous Output {!previousNodeType ? '(no previous node)' : availableFields.length === 0 ? '(no outputs)' : ''}
          </SelectItem>
          <SelectItem value="currentBalance">Wallet Balance</SelectItem>
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

      {/* Current Balance */}
      {normalizedValue.type === 'currentBalance' && (
        <div className="space-y-3">
          {isSwapNode ? (
            firstTokenInPath ? (
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground">
                  Using balance of first token in swap path: <span className="font-mono text-xs">{firstTokenInPath.slice(0, 6)}...{firstTokenInPath.slice(-4)}</span>
                </p>
              </div>
            ) : (
              <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3">
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  Please configure the token path first. The wallet balance will use the first token in the path.
                </p>
              </div>
            )
          ) : (
            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground">Token Address</label>
              <Input
                type="text"
                placeholder="0x..."
                value={normalizedValue.token}
                onChange={(e) =>
                  onChange({
                    ...normalizedValue,
                    token: e.target.value,
                  })
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                Enter token address (use separate PLS nodes for PLS operations)
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
    </div>
  );
}
