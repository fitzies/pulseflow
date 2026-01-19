'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SlippageSelectorProps {
  value: number; // decimal value (e.g., 0.01 for 1%)
  onChange: (value: number) => void;
}

const PRESETS = [
  { label: '1%', value: 0.01 },
  { label: '3%', value: 0.03 },
  { label: '10%', value: 0.1 },
];

export function SlippageSelector({ value, onChange }: SlippageSelectorProps) {
  const handlePresetClick = (presetValue: number) => {
    onChange(presetValue);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Slippage Tolerance</label>
      <div className="flex gap-2 mt-2">
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
      </div>
      <p className="text-xs text-muted-foreground">
        Your transaction will revert if the price changes unfavorably by more than this percentage.
      </p>
    </div>
  );
}
