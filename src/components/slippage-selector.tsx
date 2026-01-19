'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SlippageSelectorProps {
  value: number; // decimal value (e.g., 0.005 for 0.5%)
  onChange: (value: number) => void;
}

const PRESETS = [
  { label: '1%', value: 0.01 },
  { label: '3%', value: 0.03 },
];

export function SlippageSelector({ value, onChange }: SlippageSelectorProps) {
  const isPreset = PRESETS.some((preset) => preset.value === value);
  const customValue = isPreset ? '' : (value * 100).toFixed(2);

  const handlePresetClick = (presetValue: number) => {
    onChange(presetValue);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === '') {
      onChange(0.01); // default to 1%
      return;
    }
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue) && numValue >= 0) {
      onChange(numValue / 100); // convert percentage to decimal
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Slippage Tolerance</label>
      <div className="flex gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.value}
            type="button"
            variant={value === preset.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(preset.value)}
            className={cn(
              'flex-1',
              value === preset.value && 'bg-primary text-primary-foreground'
            )}
          >
            {preset.label}
          </Button>
        ))}
        <div className="relative flex-1">
          <Input
            type="number"
            placeholder={isPreset ? 'Custom' : ''}
            value={customValue}
            onChange={handleCustomChange}
            className={cn(
              'h-9 text-center',
              !isPreset && 'border-primary'
            )}
            step="0.1"
            min="0"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {isPreset ? 'Custom' : '%'}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Your transaction will revert if the price changes unfavorably by more than this percentage.
      </p>
    </div>
  );
}
