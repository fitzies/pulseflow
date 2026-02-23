'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusIcon, XMarkIcon, TrashIcon, LockClosedIcon, ArrowPathRoundedSquareIcon } from '@heroicons/react/24/solid';
import { Switch } from '@/components/ui/switch';
import { ExternalLink } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { NodeType } from '@/components/select-node-dialog';
import { SlippageSelector } from '@/components/slippage-selector';
import { AmountSelector } from '@/components/amount-selector';
import type { Node, Edge } from '@xyflow/react';
import { CONFIG } from '@/lib/config';
import { SCHEDULE_PRESETS, validateMinimumIntervalClient } from '@/lib/cron-utils';
import { updateAutomationSchedule, updateAutomationPriceTrigger } from '@/lib/actions/automations';
import { toast } from 'sonner';
import { useNodeValidation } from '@/components/hooks/useNodeValidation';
import { TokenCommandInput } from '@/components/token-command-input';

const FOREACH_ITEM_SENTINEL = '__FOREACH_ITEM__';

// Helper component for address inputs with validation and token name
function AddressInput({
  id,
  value,
  onChange,
  onValueChange,
  placeholder = '0x...',
  label,
  fieldName,
  hardError,
  softWarning,
  showTokenName = true,
  expectedType,
  allowForEachItem,
  onForEachToggle,
}: {
  id: string;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  fieldName: string;
  hardError?: string;
  softWarning?: string;
  showTokenName?: boolean;
  expectedType?: 'token' | 'lp';
  allowForEachItem?: boolean;
  onForEachToggle?: (enabled: boolean) => void;
}) {
  const isForEachItem = value === FOREACH_ITEM_SENTINEL;
  // Use TokenCommandInput for token/LP fields, plain Input for wallet addresses
  const useCommandPicker = showTokenName;

  const borderClass = hardError
    ? 'border-destructive'
    : softWarning
      ? 'border-yellow-500'
      : '';

  return (
    <div className="grid gap-3">
      {label && <label htmlFor={id} className="text-sm font-medium">{label}</label>}
      {/* For plain wallet address fields, keep the old forEach toggle */}
      {!useCommandPicker && allowForEachItem && onForEachToggle && (
        <button
          type="button"
          onClick={() => onForEachToggle(!isForEachItem)}
          className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${isForEachItem
              ? 'border-orange-500/50 bg-orange-500/10 text-orange-500'
              : 'border-border bg-transparent text-muted-foreground hover:bg-accent'
            }`}
        >
          <ArrowPathRoundedSquareIcon className="h-3.5 w-3.5" />
          Use For-Each Item
        </button>
      )}
      <div className="space-y-1">
        {useCommandPicker ? (
          <TokenCommandInput
            value={value}
            onChange={(addr) => onValueChange?.(addr)}
            expectedType={expectedType}
            placeholder={placeholder}
            className={borderClass}
            allowForEachItem={allowForEachItem}
          />
        ) : isForEachItem ? (
          <div className="flex items-center gap-2 rounded-md border border-orange-500/50 bg-orange-500/10 px-3 py-2 text-sm text-orange-500">
            <ArrowPathRoundedSquareIcon className="h-4 w-4" />
            For-Each Item
          </div>
        ) : (
          <Input
            id={id}
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className={borderClass}
          />
        )}
        {hardError && (
          <p className="text-xs text-destructive">{hardError}</p>
        )}
        {softWarning && (
          <p className="text-xs text-yellow-600">{softWarning}</p>
        )}
      </div>
    </div>
  );
}

// ForEachItemInput component for forEach address list
function ForEachItemInput({
  address,
  idx,
  expectedType,
  onUpdate,
  onRemove,
  hardError,
}: {
  address: string;
  idx: number;
  expectedType: 'token' | 'lp';
  onUpdate: (value: string) => void;
  onRemove: () => void;
  hardError?: string;
}) {
  const borderClass = hardError ? 'border-destructive' : '';

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <div className="flex-1">
          <TokenCommandInput
            value={address}
            onChange={onUpdate}
            expectedType={expectedType}
            className={borderClass}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onRemove}
        >
          <XMarkIcon className="h-4 w-4" />
        </Button>
      </div>
      {hardError && (
        <p className="text-xs text-destructive">{hardError}</p>
      )}
    </div>
  );
}

// PathTokenInput component for swap path arrays - defined outside to prevent focus loss on re-render
function PathTokenInput({
  address,
  idx,
  onUpdate,
  onRemove,
  hardError,
  allowForEachItem,
}: {
  address: string;
  idx: number;
  onUpdate: (value: string) => void;
  onRemove: () => void;
  hardError?: string;
  allowForEachItem?: boolean;
}) {
  const borderClass = hardError ? 'border-destructive' : '';

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <div className="flex-1">
          <TokenCommandInput
            value={address}
            onChange={onUpdate}
            expectedType="token"
            className={borderClass}
            allowForEachItem={allowForEachItem}
          />
        </div>
        <Button type="button" variant="outline" size="icon" onClick={onRemove}>
          <XMarkIcon className="h-4 w-4" />
        </Button>
      </div>
      {hardError && (
        <p className="text-xs text-destructive">{hardError}</p>
      )}
    </div>
  );
}

interface NodeConfigSheetProps {
  nodeId: string | null;
  nodeType: NodeType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: Record<string, any> | undefined;
  onSave: (nodeId: string, config: Record<string, any>) => void;
  onDelete?: (nodeId: string) => void;
  nodes: Node[];
  edges: Edge[];
  // Schedule props for start node
  automationId: string;
  walletAddress: string;
  userPlan: 'BASIC' | 'PRO' | 'ULTRA' | null;
  triggerMode: 'MANUAL' | 'SCHEDULE' | 'PRICE_TRIGGER';
  cronExpression: string | null;
  onScheduleUpdate: (triggerMode: 'MANUAL' | 'SCHEDULE' | 'PRICE_TRIGGER', cronExpression: string | null, nextRunAt: Date | null) => void;
  // Price trigger props
  priceTriggerLpAddress?: string | null;
  priceTriggerOperator?: string | null;
  priceTriggerValue?: number | null;
  priceTriggerCooldownMinutes?: number | null;
  onPriceTriggerUpdate?: (
    lpAddress: string,
    operator: string,
    value: number,
    cooldownMinutes: number
  ) => void;
}

export function NodeConfigSheet({
  nodeId,
  nodeType,
  open,
  onOpenChange,
  config,
  onSave,
  onDelete,
  nodes,
  edges,
  automationId,
  walletAddress,
  userPlan,
  triggerMode,
  cronExpression,
  onScheduleUpdate,
  priceTriggerLpAddress,
  priceTriggerOperator,
  priceTriggerValue,
  priceTriggerCooldownMinutes,
  onPriceTriggerUpdate,
}: NodeConfigSheetProps) {
  // Find previous node in the chain
  const previousNode = (() => {
    if (!nodeId) return null;
    const incomingEdge = edges.find((e) => e.target === nodeId);
    if (!incomingEdge) return null;
    return nodes.find((n) => n.id === incomingEdge.source);
  })();

  const previousNodeType = previousNode?.type || null;
  const previousNodeConfig = previousNode?.data?.config || {};
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Validation hook
  const validation = useNodeValidation(formData, nodeType, automationId);

  // Check if this node is inside a forEach body (between a forEach and its paired endForEach)
  const isInsideForEach = (() => {
    if (!nodeId) return false;
    // Walk backwards from this node — if we reach a forEach before reaching start (without crossing an endForEach), we're inside a forEach body
    const visited = new Set<string>();
    const queue = [nodeId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const currentNode = nodes.find((n) => n.id === currentId);
      if (!currentNode) continue;
      if (currentNode.type === 'forEach') return true;
      if (currentNode.type === 'endForEach') continue; // Don't traverse past an endForEach backwards
      // Walk backwards via incoming edges
      const incoming = edges.filter((e) => e.target === currentId);
      for (const edge of incoming) {
        if (!visited.has(edge.source)) {
          queue.push(edge.source);
        }
      }
    }
    return false;
  })();

  // Schedule state for start node
  const [scheduleTriggerMode, setScheduleTriggerMode] = useState<'MANUAL' | 'SCHEDULE' | 'PRICE_TRIGGER'>(triggerMode);
  const [schedulePreset, setSchedulePreset] = useState<string>(
    SCHEDULE_PRESETS.find((p) => p.value === cronExpression)?.value || SCHEDULE_PRESETS[0].value
  );
  const [customCronExpression, setCustomCronExpression] = useState(cronExpression || '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cronError, setCronError] = useState<string | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Price trigger state
  const [priceLpAddress, setPriceLpAddress] = useState(priceTriggerLpAddress || '');
  const [priceOperator, setPriceOperator] = useState(priceTriggerOperator || '<');
  const [priceValue, setPriceValue] = useState(priceTriggerValue?.toString() || '');
  const [priceCooldown, setPriceCooldown] = useState(priceTriggerCooldownMinutes?.toString() || '15');
  const [priceError, setPriceError] = useState<string | null>(null);

  // Gas guard state - current network gas price
  const [currentGasBeats, setCurrentGasBeats] = useState<number | null>(null);
  const [gasLoading, setGasLoading] = useState(false);

  const isPro = userPlan === 'PRO' || userPlan === 'ULTRA';

  useEffect(() => {
    if (config) {
      setFormData(config);
    } else {
      setFormData({});
    }
  }, [config, nodeType]);

  // Reset schedule state when props change
  useEffect(() => {
    setScheduleTriggerMode(triggerMode);
    const matchingPreset = SCHEDULE_PRESETS.find((p) => p.value === cronExpression);
    if (matchingPreset) {
      setSchedulePreset(matchingPreset.value);
    } else {
      setSchedulePreset(SCHEDULE_PRESETS[0].value);
    }
    setShowAdvanced(false);
    setCustomCronExpression(cronExpression || '');
    setCronError(null);

    // Reset price trigger state
    setPriceLpAddress(priceTriggerLpAddress || '');
    setPriceOperator(priceTriggerOperator || '<');
    setPriceValue(priceTriggerValue?.toString() || '');
    setPriceCooldown(priceTriggerCooldownMinutes?.toString() || '15');
    setPriceError(null);
  }, [triggerMode, cronExpression, priceTriggerLpAddress, priceTriggerOperator, priceTriggerValue, priceTriggerCooldownMinutes]);

  // Fetch current gas price when gas guard node is opened
  useEffect(() => {
    if (nodeType === 'gasGuard' && open) {
      setGasLoading(true);
      fetch('https://api.scan.pulsechain.com/api/v2/stats')
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.gas_prices?.average) {
            setCurrentGasBeats(data.gas_prices.average);
          }
        })
        .catch(() => {
          // Silently fail - gas price display is optional
        })
        .finally(() => setGasLoading(false));
    }
  }, [nodeType, open]);

  const handleSave = () => {
    if (!nodeId) return;

    // Check validation before saving
    if (!validation.isValid) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    // Auto-prepend WPLS to swapFromPLS path if not already present
    // Auto-append WPLS to swapToPLS path if not already present
    let configToSave = { ...formData };
    if (nodeType === 'swapFromPLS' && configToSave.path && Array.isArray(configToSave.path)) {
      const path = configToSave.path as string[];
      if (path.length === 0 || path[0]?.toLowerCase() !== CONFIG.wpls.toLowerCase()) {
        configToSave = {
          ...configToSave,
          path: [CONFIG.wpls, ...path],
        };
      }
    } else if (nodeType === 'swapToPLS' && configToSave.path && Array.isArray(configToSave.path)) {
      const path = configToSave.path as string[];
      if (path.length === 0 || path[path.length - 1]?.toLowerCase() !== CONFIG.wpls.toLowerCase()) {
        configToSave = {
          ...configToSave,
          path: [...path, CONFIG.wpls],
        };
      }
    }

    onSave(nodeId, configToSave);
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!nodeId || !onDelete) return;
    onDelete(nodeId);
    onOpenChange(false);
  };

  const canDelete = nodeType !== null && nodeType !== 'start' && onDelete;

  const updateField = (field: string, value: any) => {
    // When conditionType changes to previousOutput, set default field if not already set
    if (field === 'conditionType' && value === 'previousOutput') {
      setFormData((prev) => {
        const updates: Record<string, any> = { [field]: value };
        // Set default previousOutputField if not already set
        if (!prev.previousOutputField) {
          const fields = getPreviousOutputFields();
          if (fields.length > 0) {
            updates.previousOutputField = fields[0].value;
          }
        }
        return { ...prev, ...updates };
      });
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Helper to create a forEach toggle handler for address fields
  const makeForEachToggle = (fieldName: string) => (enabled: boolean) => {
    updateField(fieldName, enabled ? FOREACH_ITEM_SENTINEL : '');
  };

  const updateArrayField = (field: string, index: number, value: string) => {
    setFormData((prev) => {
      const arr = prev[field] || [];
      const newArr = [...arr];
      newArr[index] = value;
      return { ...prev, [field]: newArr };
    });
  };

  const addArrayItem = (field: string) => {
    setFormData((prev) => {
      const arr = prev[field] || [];
      return { ...prev, [field]: [...arr, ''] };
    });
  };

  const removeArrayItem = (field: string, index: number) => {
    setFormData((prev) => {
      const arr = prev[field] || [];
      const newArr = arr.filter((_: any, i: number) => i !== index);
      return { ...prev, [field]: newArr };
    });
  };

  // DEX selector commented out — always use PulseX for now
  const renderDexSelector = () => null;

  const renderSwapConfig = () => {
    const swapMode = formData.swapMode || 'exactIn';
    const autoRoute = formData.autoRoute ?? false;
    return (
      <div className="grid flex-1 auto-rows-min gap-6 px-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-sm font-medium">Auto Route</label>
            <p className="text-xs text-muted-foreground">
              {isPro ? 'Finds the best swap route automatically' : 'Upgrade to Pro to use auto routing'}
            </p>
          </div>
          <Switch
            checked={autoRoute}
            onCheckedChange={(checked) => updateField('autoRoute', checked)}
            disabled={!isPro}
          />
        </div>
        {!autoRoute && renderDexSelector()}
        <div className="grid gap-3">
          <label className="text-sm font-medium">Swap Mode</label>
          <Select
            value={swapMode}
            onValueChange={(value) => updateField('swapMode', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exactIn">Amount In (specify input)</SelectItem>
              <SelectItem value="exactOut">Amount Out (specify desired output)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {swapMode === 'exactIn'
              ? 'Specify how many tokens to swap'
              : 'Specify how many tokens you want to receive'}
          </p>
        </div>
        <AmountSelector
          value={swapMode === 'exactOut' ? formData.amountOut : formData.amountIn}
          onChange={(value) => updateField(swapMode === 'exactOut' ? 'amountOut' : 'amountIn', value)}
          previousNodeType={previousNodeType}
          previousNodeConfig={previousNodeConfig}
          label={swapMode === 'exactOut' ? 'Amount Out' : 'Amount In'}
          fieldName={swapMode === 'exactOut' ? 'amountOut' : 'amountIn'}
          nodeType="swap"
          formData={formData}
          nodes={nodes}
        />
        {autoRoute ? (
          <>
            <AddressInput
              id="tokenIn"
              fieldName="tokenIn"
              label="Token In"
              value={formData.tokenIn || ''}
              onValueChange={(value) => updateField('tokenIn', value)}
              placeholder="0x... token address"
            />
            <AddressInput
              id="tokenOut"
              fieldName="tokenOut"
              label="Token Out"
              value={formData.tokenOut || ''}
              onValueChange={(value) => updateField('tokenOut', value)}
              placeholder="0x... token address"
            />
          </>
        ) : (
          <div className="grid gap-3">
            <label className="text-sm font-medium">Token Path</label>
            {validation.hardErrors.path && (
              <p className="text-xs text-destructive">{validation.hardErrors.path}</p>
            )}
            <div className="space-y-2">
              {(formData.path || []).map((item: string, index: number) => (
                <PathTokenInput
                  key={index}
                  address={item}
                  idx={index}
                  onUpdate={(value) => updateArrayField('path', index, value)}
                  onRemove={() => removeArrayItem('path', index)}
                  hardError={validation.hardErrors[`path[${index}]`]}
                  allowForEachItem={isInsideForEach}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addArrayItem('path')}
              className="w-full"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Token
            </Button>
          </div>
        )}
        <div className="grid gap-3">
          <SlippageSelector
            value={formData.slippage ?? 0.01}
            onChange={(value) => updateField('slippage', value)}
          />
          {validation.hardErrors.slippage && (
            <p className="text-xs text-destructive">{validation.hardErrors.slippage}</p>
          )}
          {validation.softWarnings.slippage && (
            <p className="text-xs text-yellow-600">{validation.softWarnings.slippage}</p>
          )}
        </div>
        {renderNotesField()}
      </div>
    );
  };

  const renderSwapFromPLSConfig = () => {
    const swapMode = formData.swapMode || 'exactIn';
    const autoRoute = formData.autoRoute ?? false;
    return (
      <div className="grid flex-1 auto-rows-min gap-6 px-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-sm font-medium">Auto Route</label>
            <p className="text-xs text-muted-foreground">
              {isPro ? 'Finds the best swap route automatically' : 'Upgrade to Pro to use auto routing'}
            </p>
          </div>
          <Switch
            checked={autoRoute}
            onCheckedChange={(checked) => updateField('autoRoute', checked)}
            disabled={!isPro}
          />
        </div>
        {!autoRoute && renderDexSelector()}
        <div className="grid gap-3">
          <label className="text-sm font-medium">Swap Mode</label>
          <Select
            value={swapMode}
            onValueChange={(value) => updateField('swapMode', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exactIn">Amount In (specify PLS input)</SelectItem>
              <SelectItem value="exactOut">Amount Out (specify desired tokens)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {swapMode === 'exactIn'
              ? 'Specify how much PLS to swap'
              : 'Specify how many tokens you want to receive'}
          </p>
        </div>
        <AmountSelector
          value={swapMode === 'exactOut' ? formData.amountOut : formData.plsAmount}
          onChange={(value) => updateField(swapMode === 'exactOut' ? 'amountOut' : 'plsAmount', value)}
          previousNodeType={previousNodeType}
          previousNodeConfig={previousNodeConfig}
          label={swapMode === 'exactOut' ? 'Amount Out (Tokens)' : 'PLS Amount'}
          fieldName={swapMode === 'exactOut' ? 'amountOut' : 'plsAmount'}
          nodeType="swapFromPLS"
          formData={formData}
          isPLSAmount={swapMode !== 'exactOut'}
          nodes={nodes}
        />
        {autoRoute ? (
          <AddressInput
            id="tokenOut"
            fieldName="tokenOut"
            label="Token Out"
            value={formData.tokenOut || ''}
            onValueChange={(value) => updateField('tokenOut', value)}
            placeholder="0x... token address"
          />
        ) : (
          <div className="grid gap-3">
            <label className="text-sm font-medium">Token Path</label>
            <div className="text-xs text-muted-foreground mb-2">
              WPLS will be automatically added as the first token in the path
            </div>
            {validation.hardErrors.path && (
              <p className="text-xs text-destructive">{validation.hardErrors.path}</p>
            )}
            <div className="space-y-2">
              {(formData.path || []).map((item: string, index: number) => (
                <PathTokenInput
                  key={index}
                  address={item}
                  idx={index}
                  onUpdate={(value) => updateArrayField('path', index, value)}
                  onRemove={() => removeArrayItem('path', index)}
                  hardError={validation.hardErrors[`path[${index}]`]}
                  allowForEachItem={isInsideForEach}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addArrayItem('path')}
              className="w-full"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Token
            </Button>
          </div>
        )}
        <div className="grid gap-3">
          <SlippageSelector
            value={formData.slippage ?? 0.01}
            onChange={(value) => updateField('slippage', value)}
          />
          {validation.hardErrors.slippage && (
            <p className="text-xs text-destructive">{validation.hardErrors.slippage}</p>
          )}
          {validation.softWarnings.slippage && (
            <p className="text-xs text-yellow-600">{validation.softWarnings.slippage}</p>
          )}
        </div>
        {renderNotesField()}
      </div>
    );
  };

  const renderSwapToPLSConfig = () => {
    const swapMode = formData.swapMode || 'exactIn';
    const autoRoute = formData.autoRoute ?? false;
    return (
      <div className="grid flex-1 auto-rows-min gap-6 px-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-sm font-medium">Auto Route</label>
            <p className="text-xs text-muted-foreground">
              {isPro ? 'Finds the best swap route automatically' : 'Upgrade to Pro to use auto routing'}
            </p>
          </div>
          <Switch
            checked={autoRoute}
            onCheckedChange={(checked) => updateField('autoRoute', checked)}
            disabled={!isPro}
          />
        </div>
        {!autoRoute && renderDexSelector()}
        <div className="grid gap-3">
          <label className="text-sm font-medium">Swap Mode</label>
          <Select
            value={swapMode}
            onValueChange={(value) => updateField('swapMode', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exactIn">Amount In (specify token input)</SelectItem>
              <SelectItem value="exactOut">Amount Out (specify desired PLS)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {swapMode === 'exactIn'
              ? 'Specify how many tokens to swap'
              : 'Specify how much PLS you want to receive'}
          </p>
        </div>
        <AmountSelector
          value={swapMode === 'exactOut' ? formData.plsAmountOut : formData.amountIn}
          onChange={(value) => updateField(swapMode === 'exactOut' ? 'plsAmountOut' : 'amountIn', value)}
          previousNodeType={previousNodeType}
          previousNodeConfig={previousNodeConfig}
          label={swapMode === 'exactOut' ? 'PLS Amount Out' : 'Amount In'}
          fieldName={swapMode === 'exactOut' ? 'plsAmountOut' : 'amountIn'}
          nodeType="swapToPLS"
          formData={formData}
          isPLSAmount={swapMode === 'exactOut'}
          nodes={nodes}
        />
        {autoRoute ? (
          <AddressInput
            id="tokenIn"
            fieldName="tokenIn"
            label="Token In"
            value={formData.tokenIn || ''}
            onValueChange={(value) => updateField('tokenIn', value)}
            placeholder="0x... token address"
          />
        ) : (
          <div className="grid gap-3">
            <label className="text-sm font-medium">Token Path</label>
            <div className="text-xs text-muted-foreground mb-2">
              WPLS will be automatically added as the last token in the path
            </div>
            {validation.hardErrors.path && (
              <p className="text-xs text-destructive">{validation.hardErrors.path}</p>
            )}
            <div className="space-y-2">
              {(formData.path || []).map((item: string, index: number) => (
                <PathTokenInput
                  key={index}
                  address={item}
                  idx={index}
                  onUpdate={(value) => updateArrayField('path', index, value)}
                  onRemove={() => removeArrayItem('path', index)}
                  hardError={validation.hardErrors[`path[${index}]`]}
                  allowForEachItem={isInsideForEach}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addArrayItem('path')}
              className="w-full"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Token
            </Button>
          </div>
        )}
        <div className="grid gap-3">
          <SlippageSelector
            value={formData.slippage ?? 0.01}
            onChange={(value) => updateField('slippage', value)}
          />
          {validation.hardErrors.slippage && (
            <p className="text-xs text-destructive">{validation.hardErrors.slippage}</p>
          )}
          {validation.softWarnings.slippage && (
            <p className="text-xs text-yellow-600">{validation.softWarnings.slippage}</p>
          )}
        </div>
        {renderNotesField()}
      </div>
    );
  };

  const renderTransferConfig = () => {
    const tokenType = formData.tokenType || 'token';
    return (
      <div className="grid flex-1 auto-rows-min gap-6 px-4">
        <div className="grid gap-3">
          <label className="text-sm font-medium">Token Type</label>
          <Select
            value={tokenType}
            onValueChange={(value) => updateField('tokenType', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="token">Regular Token (ERC20)</SelectItem>
              <SelectItem value="lp">LP Token</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {tokenType === 'token'
              ? 'Transfer a regular ERC20 token'
              : 'Transfer LP tokens from a liquidity pool'}
          </p>
        </div>
        <AddressInput
          id="token"
          value={formData.token || ''}
          onValueChange={(value) => updateField('token', value)}
          label={tokenType === 'lp' ? 'LP Token Address' : 'Token Address'}
          fieldName="token"
          hardError={validation.hardErrors.token}
          softWarning={validation.softWarnings.token}
          expectedType={tokenType as 'token' | 'lp'}
          allowForEachItem={isInsideForEach}
        />
        <AddressInput
          id="to"
          value={formData.to || ''}
          onChange={(e) => updateField('to', e.target.value)}
          label="To Address"
          fieldName="to"
          hardError={validation.hardErrors.to}
          showTokenName={false}
          allowForEachItem={isInsideForEach}
          onForEachToggle={makeForEachToggle('to')}
        />
        <AmountSelector
          value={formData.amount}
          onChange={(value) => updateField('amount', value)}
          previousNodeType={previousNodeType}
          previousNodeConfig={previousNodeConfig}
          label="Amount"
          fieldName="amount"
          nodeType="transfer"
          formData={formData}
          nodes={nodes}
        />
        {renderNotesField()}
      </div>
    );
  };

  const renderTransferPLSConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="to"
        value={formData.to || ''}
        onChange={(e) => updateField('to', e.target.value)}
        label="To Address"
        fieldName="to"
        hardError={validation.hardErrors.to}
        showTokenName={false}
        allowForEachItem={isInsideForEach}
        onForEachToggle={makeForEachToggle('to')}
      />
      <AmountSelector
        value={formData.plsAmount}
        onChange={(value) => updateField('plsAmount', value)}
        previousNodeType={previousNodeType}
        previousNodeConfig={previousNodeConfig}
        label="PLS Amount"
        fieldName="plsAmount"
        nodeType="transferPLS"
        formData={formData}
        isPLSAmount={true}
        nodes={nodes}
      />
    </div>
  );

  const renderAddLiquidityConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="tokenA"
        value={formData.tokenA || ''}
        onValueChange={(value) => updateField('tokenA', value)}
        label="Token A Address"
        fieldName="tokenA"
        hardError={validation.hardErrors.tokenA}
        softWarning={validation.softWarnings.tokenA}
        expectedType="token"
        allowForEachItem={isInsideForEach}
      />
      <AddressInput
        id="tokenB"
        value={formData.tokenB || ''}
        onValueChange={(value) => updateField('tokenB', value)}
        label="Token B Address"
        fieldName="tokenB"
        hardError={validation.hardErrors.tokenB}
        softWarning={validation.softWarnings.tokenB}
        expectedType="token"
        allowForEachItem={isInsideForEach}
      />
      <AmountSelector
        value={formData.amountADesired}
        onChange={(value) => updateField('amountADesired', value)}
        previousNodeType={previousNodeType}
        previousNodeConfig={previousNodeConfig}
        label="Amount A"
        fieldName="amountADesired"
        nodeType="addLiquidity"
        formData={formData}
        nodes={nodes}
      />
      <AmountSelector
        value={formData.amountBDesired}
        onChange={(value) => updateField('amountBDesired', value)}
        previousNodeType={previousNodeType}
        previousNodeConfig={previousNodeConfig}
        label="Amount B"
        fieldName="amountBDesired"
        nodeType="addLiquidity"
        formData={formData}
        lpRatioConfig={{
          baseTokenField: 'tokenA',
          baseAmountField: 'amountADesired',
          pairedTokenField: 'tokenB',
        }}
        nodes={nodes}
      />
      <SlippageSelector
        value={formData.slippage ?? 0.01}
        onChange={(value) => updateField('slippage', value)}
      />
      {renderNotesField()}
    </div>
  );

  const renderAddLiquidityPLSConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="token"
        value={formData.token || ''}
        onValueChange={(value) => updateField('token', value)}
        label="Token Address"
        fieldName="token"
        hardError={validation.hardErrors.token}
        softWarning={validation.softWarnings.token}
        expectedType="token"
        allowForEachItem={isInsideForEach}
      />
      <AmountSelector
        value={formData.amountTokenDesired}
        onChange={(value) => updateField('amountTokenDesired', value)}
        previousNodeType={previousNodeType}
        previousNodeConfig={previousNodeConfig}
        label="Token Amount"
        fieldName="amountTokenDesired"
        nodeType="addLiquidityPLS"
        formData={formData}
        lpRatioConfig={{
          baseTokenField: 'token',
          baseAmountField: 'plsAmount',
          pairedTokenField: 'token',
          isPLS: true,
        }}
        nodes={nodes}
      />
      <AmountSelector
        value={formData.plsAmount}
        onChange={(value) => updateField('plsAmount', value)}
        previousNodeType={previousNodeType}
        previousNodeConfig={previousNodeConfig}
        label="PLS Amount"
        fieldName="plsAmount"
        nodeType="addLiquidityPLS"
        formData={formData}
        isPLSAmount={true}
        lpRatioConfig={{
          baseTokenField: 'token',
          baseAmountField: 'amountTokenDesired',
          pairedTokenField: 'token',
          isPLS: true,
        }}
        nodes={nodes}
      />
      <SlippageSelector
        value={formData.slippage ?? 0.01}
        onChange={(value) => updateField('slippage', value)}
      />
      {renderNotesField()}
    </div>
  );

  const renderRemoveLiquidityConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="tokenA"
        value={formData.tokenA || ''}
        onValueChange={(value) => updateField('tokenA', value)}
        label="Token A Address"
        fieldName="tokenA"
        hardError={validation.hardErrors.tokenA}
        softWarning={validation.softWarnings.tokenA}
        expectedType="token"
        allowForEachItem={isInsideForEach}
      />
      <AddressInput
        id="tokenB"
        value={formData.tokenB || ''}
        onValueChange={(value) => updateField('tokenB', value)}
        label="Token B Address"
        fieldName="tokenB"
        hardError={validation.hardErrors.tokenB}
        softWarning={validation.softWarnings.tokenB}
        expectedType="token"
        allowForEachItem={isInsideForEach}
      />
      <AmountSelector
        value={formData.liquidity}
        onChange={(value) => updateField('liquidity', value)}
        previousNodeType={previousNodeType}
        previousNodeConfig={previousNodeConfig}
        label="LP Token Amount"
        fieldName="liquidity"
        nodeType="removeLiquidity"
        formData={formData}
        nodes={nodes}
      />
      <SlippageSelector
        value={formData.slippage ?? 0.01}
        onChange={(value) => updateField('slippage', value)}
      />
      {renderNotesField()}
    </div>
  );

  const renderRemoveLiquidityPLSConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="token"
        value={formData.token || ''}
        onValueChange={(value) => updateField('token', value)}
        label="Token Address"
        fieldName="token"
        hardError={validation.hardErrors.token}
        softWarning={validation.softWarnings.token}
        expectedType="token"
        allowForEachItem={isInsideForEach}
      />
      <AmountSelector
        value={formData.liquidity}
        onChange={(value) => updateField('liquidity', value)}
        previousNodeType={previousNodeType}
        previousNodeConfig={previousNodeConfig}
        label="LP Token Amount"
        fieldName="liquidity"
        nodeType="removeLiquidityPLS"
        formData={formData}
        nodes={nodes}
      />
      <SlippageSelector
        value={formData.slippage ?? 0.01}
        onChange={(value) => updateField('slippage', value)}
      />
      {renderNotesField()}
    </div>
  );

  const renderBurnTokenConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="token"
        value={formData.token || ''}
        onValueChange={(value) => updateField('token', value)}
        label="Token Address"
        fieldName="token"
        hardError={validation.hardErrors.token}
        softWarning={validation.softWarnings.token}
        expectedType="token"
        allowForEachItem={isInsideForEach}
      />
      <p className="text-xs text-muted-foreground px-4">
        Only playground tokens are allowed. Playground tokens have a parent() function.
      </p>
      <AmountSelector
        value={formData.amount}
        onChange={(value) => updateField('amount', value)}
        previousNodeType={previousNodeType}
        previousNodeConfig={previousNodeConfig}
        label="Amount"
        fieldName="amount"
        nodeType="burnToken"
        formData={formData}
        nodes={nodes}
      />
      {renderNotesField()}
    </div>
  );

  const renderClaimTokenConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="token"
        value={formData.token || ''}
        onValueChange={(value) => updateField('token', value)}
        label="Token Address"
        fieldName="token"
        hardError={validation.hardErrors.token}
        softWarning={validation.softWarnings.token}
        expectedType="token"
        allowForEachItem={isInsideForEach}
      />
      <p className="text-xs text-muted-foreground px-4">
        Only playground tokens are allowed. Playground tokens have a parent() function.
      </p>
      <AmountSelector
        value={formData.amount}
        onChange={(value) => updateField('amount', value)}
        previousNodeType={previousNodeType}
        previousNodeConfig={previousNodeConfig}
        label="Amount"
        fieldName="amount"
        nodeType="claimToken"
        formData={formData}
        nodes={nodes}
      />
      {renderNotesField()}
    </div>
  );

  const renderGetParentConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="token"
        value={formData.token || ''}
        onValueChange={(value) => updateField('token', value)}
        label="Token Address"
        fieldName="token"
        hardError={validation.hardErrors.token}
        softWarning={validation.softWarnings.token}
        expectedType="token"
        allowForEachItem={isInsideForEach}
      />
      <p className="text-xs text-muted-foreground px-4">
        Only playground tokens are allowed. Playground tokens have a parent() function.
      </p>
      {renderNotesField()}
    </div>
  );

  const renderCheckLPTokenAmountsConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="pairAddress"
        value={formData.pairAddress || ''}
        onValueChange={(value) => updateField('pairAddress', value)}
        label="Pair Address"
        fieldName="pairAddress"
        hardError={validation.hardErrors.pairAddress}
        softWarning={validation.softWarnings.pairAddress}
        expectedType="lp"
        allowForEachItem={isInsideForEach}
      />
      <div className="grid gap-2 p-4 bg-muted rounded-lg">
        <h4 className="text-sm font-medium">How the Ratio is Calculated</h4>
        <p className="text-xs text-muted-foreground">
          This node checks the liquidity pool pair and calculates the ratio of tokens in the LP.
        </p>
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Formula:</strong> ratio = token1Amount ÷ token0Amount</p>
          <p><strong>Example:</strong> If token0 has 1000 tokens and token1 has 1100 tokens, the ratio is 1.1</p>
          <p className="mt-2">
            The ratio output can be used in condition nodes to compare against thresholds (e.g., ratio {'>'} 1.0).
          </p>
        </div>
      </div>
      {renderNotesField()}
    </div>
  );

  const renderWaitConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <div className="grid gap-3">
        <label htmlFor="delay" className="text-sm font-medium">Delay</label>
        <Input
          id="delay"
          type="number"
          placeholder="0"
          min={1}
          max={10}
          value={formData.delay || ''}
          onChange={(e) => updateField('delay', Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
          className={validation.hardErrors.delay ? 'border-destructive' : validation.softWarnings.delay ? 'border-yellow-500' : ''}
        />
        <p className="text-xs text-muted-foreground">Delay in seconds (max 10 seconds)</p>
        {validation.hardErrors.delay && (
          <p className="text-xs text-destructive">{validation.hardErrors.delay}</p>
        )}
        {validation.softWarnings.delay && (
          <p className="text-xs text-yellow-600">{validation.softWarnings.delay}</p>
        )}
      </div>
      {renderNotesField()}
    </div>
  );

  const renderCheckTokenBalanceConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="token"
        value={formData.token || ''}
        onValueChange={(value) => updateField('token', value)}
        label="Token Contract Address"
        fieldName="token"
        hardError={validation.hardErrors.token}
        softWarning={validation.softWarnings.token}
        expectedType="token"
        allowForEachItem={isInsideForEach}
      />
      <p className="text-xs text-muted-foreground px-4">The ERC20 token contract address to check balance for</p>
      {renderNotesField()}
    </div>
  );

  const renderLoopConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <div className="grid gap-3">
        <label htmlFor="loopCount" className="text-sm font-medium">Loop Count</label>
        <Input
          id="loopCount"
          type="number"
          placeholder="1"
          min={1}
          max={10}
          value={formData.loopCount || ''}
          onChange={(e) => updateField('loopCount', Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
          className={validation.hardErrors.loopCount ? 'border-destructive' : validation.softWarnings.loopCount ? 'border-yellow-500' : ''}
        />
        <p className="text-xs text-muted-foreground">Number of times to repeat the automation from the start (1-10). Execution stops at this node and repeats from the beginning. After the specified number of repeats, execution continues past this node.</p>
        {(formData.loopCount || 0) > 5 && (
          <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3">
            <p className="text-xs text-yellow-600">⚠️ More than 5 repeats may cause the automation to timeout (max runtime: 10 minutes for the entire automation).</p>
          </div>
        )}
        {validation.hardErrors.loopCount && (
          <p className="text-xs text-destructive">{validation.hardErrors.loopCount}</p>
        )}
        {validation.softWarnings.loopCount && (
          <p className="text-xs text-yellow-600">{validation.softWarnings.loopCount}</p>
        )}
      </div>
      {renderNotesField()}
    </div>
  );

  const renderForEachConfig = () => {
    const items: string[] = formData.items || [];
    const itemType: string = formData.itemType || 'token';

    return (
      <div className="grid flex-1 auto-rows-min gap-6 px-4">
        <div className="grid gap-3">
          <label className="text-sm font-medium">Item Type</label>
          <Select value={itemType} onValueChange={(v) => updateField('itemType', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="token">Tokens</SelectItem>
              <SelectItem value="lp">LP Pairs</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Select whether the list contains token addresses or LP pair addresses</p>
        </div>
        <div className="grid gap-3">
          <label className="text-sm font-medium">Addresses ({items.length}/10)</label>
          {validation.hardErrors.items && (
            <p className="text-xs text-destructive">{validation.hardErrors.items}</p>
          )}
          <div className="space-y-2">
            {items.map((item: string, index: number) => (
              <ForEachItemInput
                key={index}
                address={item}
                idx={index}
                expectedType={itemType as 'token' | 'lp'}
                onUpdate={(value) => {
                  const newItems = [...items];
                  newItems[index] = value;
                  updateField('items', newItems);
                }}
                onRemove={() => {
                  const newItems = items.filter((_: string, i: number) => i !== index);
                  updateField('items', newItems);
                }}
                hardError={validation.hardErrors[`items[${index}]`]}
              />
            ))}
          </div>
          {items.length >= 5 && (
            <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3">
              <p className="text-xs text-yellow-600">⚠️ Adding more than 5 items may cause the automation to timeout (max runtime: 10 minutes for the entire automation).</p>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateField('items', [...items, ''])}
            className="w-full"
            disabled={items.length >= 10}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add {itemType === 'lp' ? 'LP Pair' : 'Token'}
          </Button>
          <p className="text-xs text-muted-foreground">Add token or LP pair addresses to iterate over. Body nodes with &quot;Use For-Each Item&quot; enabled will use each address in turn.</p>
        </div>
        {renderNotesField()}
      </div>
    );
  };

  const renderEndForEachConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <div className="py-6 text-sm text-muted-foreground">
        This node marks the end of the For Each loop body. Nodes between For Each and End For Each will execute for each item in the list.
      </div>
      {renderNotesField()}
    </div>
  );

  const renderGasGuardConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <div className="grid gap-3">
        <label htmlFor="maxGasPrice" className="text-sm font-medium">Max Gas Price (Beats)</label>
        <Input
          id="maxGasPrice"
          type="number"
          placeholder="1000000"
          value={formData.maxGasPrice || ''}
          onChange={(e) => updateField('maxGasPrice', e.target.value)}
          className={validation.hardErrors.maxGasPrice ? 'border-destructive' : validation.softWarnings.maxGasPrice ? 'border-yellow-500' : ''}
        />
        <p className="text-xs text-muted-foreground">
          Maximum gas price in beats (wei). Automation will stop if network gas exceeds this.
          {gasLoading && ' Loading current gas...'}
          {!gasLoading && currentGasBeats !== null && (
            <span className="text-primary font-medium"> Current: ~{Math.round(currentGasBeats).toLocaleString()} beats</span>
          )}
        </p>
        {validation.hardErrors.maxGasPrice && (
          <p className="text-xs text-destructive">{validation.hardErrors.maxGasPrice}</p>
        )}
        {validation.softWarnings.maxGasPrice && (
          <p className="text-xs text-yellow-600">{validation.softWarnings.maxGasPrice}</p>
        )}
      </div>
      {renderNotesField()}
    </div>
  );

  // Get available output fields from previous node type
  const getPreviousOutputFields = () => {
    if (!previousNodeType) return [];

    const outputFields: { value: string; label: string }[] = [];

    switch (previousNodeType) {
      case 'swap':
      case 'swapFromPLS':
        outputFields.push({ value: 'amountOut', label: 'Amount Out (tokens received)' });
        break;
      case 'swapToPLS':
        outputFields.push({ value: 'amountOut', label: 'Amount Out (PLS received)' });
        break;
      case 'checkBalance':
        outputFields.push({ value: 'balance', label: 'PLS Balance' });
        break;
      case 'checkTokenBalance':
        outputFields.push({ value: 'balance', label: 'Token Balance' });
        break;
      case 'checkLPTokenAmounts':
        outputFields.push({ value: 'ratio', label: 'LP Token Ratio' });
        outputFields.push({ value: 'lpBalance', label: 'LP Token Balance' });
        outputFields.push({ value: 'token0Amount', label: 'Token 0 Amount' });
        outputFields.push({ value: 'token1Amount', label: 'Token 1 Amount' });
        break;
      case 'addLiquidity':
      case 'addLiquidityPLS':
        outputFields.push({ value: 'liquidity', label: 'LP Tokens Received' });
        break;
      case 'removeLiquidity':
      case 'removeLiquidityPLS':
        outputFields.push({ value: 'amountA', label: 'Token A Amount' });
        outputFields.push({ value: 'amountB', label: 'Token B Amount' });
        break;
      case 'variable':
        outputFields.push({ value: 'value', label: 'Variable Value' });
        break;
      case 'calculator':
        outputFields.push({ value: 'result', label: 'Calculator Result' });
        break;
      case 'dexQuote':
        outputFields.push({ value: 'quoteAmount', label: 'Quote Amount' });
        break;
    }

    return outputFields;
  };

  const renderConditionConfig = () => {
    const conditionType = formData.conditionType || 'plsBalance';
    const showTokenAddress = conditionType === 'tokenBalance';
    const showPairAddress = conditionType === 'lpAmount';
    const showPreviousOutput = conditionType === 'previousOutput';
    const previousOutputFields = getPreviousOutputFields();
    const hasPreviousNode = previousNodeType !== null;

    return (
      <div className="grid flex-1 auto-rows-min gap-6 px-4">
        <div className="grid gap-3">
          <label className="text-sm font-medium">Condition Type</label>
          <Select
            value={conditionType}
            onValueChange={(value) => updateField('conditionType', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="plsBalance">PLS Balance</SelectItem>
              <SelectItem value="tokenBalance">Token Balance</SelectItem>
              <SelectItem value="lpAmount">LP Token Amount</SelectItem>
              <SelectItem value="previousOutput" disabled={!hasPreviousNode}>
                Previous Node Output {!hasPreviousNode && '(no previous node)'}
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {conditionType === 'plsBalance' && 'Check the PLS balance of the automation wallet'}
            {conditionType === 'tokenBalance' && 'Check a specific token balance'}
            {conditionType === 'lpAmount' && 'Check LP token balance for a pair'}
            {conditionType === 'previousOutput' && 'Use output from the previous node'}
          </p>
        </div>

        {showTokenAddress && (
          <AddressInput
            id="tokenAddress"
            value={formData.tokenAddress || ''}
            onValueChange={(value) => updateField('tokenAddress', value)}
            label="Token Address"
            fieldName="tokenAddress"
            hardError={validation.hardErrors.tokenAddress}
            softWarning={validation.softWarnings.tokenAddress}
            expectedType="token"
            allowForEachItem={isInsideForEach}
          />
        )}

        {showPairAddress && (
          <AddressInput
            id="lpPairAddress"
            value={formData.lpPairAddress || ''}
            onValueChange={(value) => updateField('lpPairAddress', value)}
            label="LP Pair Address"
            fieldName="lpPairAddress"
            hardError={validation.hardErrors.lpPairAddress}
            softWarning={validation.softWarnings.lpPairAddress}
            expectedType="lp"
            allowForEachItem={isInsideForEach}
          />
        )}

        {showPreviousOutput && previousOutputFields.length > 0 && (
          <div className="grid gap-3">
            <label className="text-sm font-medium">Output Field</label>
            <Select
              value={formData.previousOutputField || previousOutputFields[0]?.value}
              onValueChange={(value) => updateField('previousOutputField', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {previousOutputFields.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select which output from the previous {previousNodeType} node to check
            </p>
          </div>
        )}

        {showPreviousOutput && previousOutputFields.length === 0 && hasPreviousNode && (
          <div className="rounded-lg bg-muted/50 border p-3">
            <p className="text-xs text-muted-foreground">
              The previous node ({previousNodeType}) does not have numeric outputs to compare.
            </p>
          </div>
        )}

        <div className="grid gap-3">
          <label className="text-sm font-medium">Operator</label>
          <Select
            value={formData.operator || '>'}
            onValueChange={(value) => updateField('operator', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=">">Greater than (&gt;)</SelectItem>
              <SelectItem value="<">Less than (&lt;)</SelectItem>
              <SelectItem value=">=">Greater or equal (&gt;=)</SelectItem>
              <SelectItem value="<=">Less or equal (&lt;=)</SelectItem>
              <SelectItem value="==">Equal (==)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3">
          <label htmlFor="value" className="text-sm font-medium">Value</label>
          <Input
            id="value"
            type="text"
            placeholder="100"
            value={formData.value || ''}
            onChange={(e) => updateField('value', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            The value to compare against (in token units, e.g., 100 for 100 PLS)
          </p>
        </div>

        <div className="rounded-lg bg-muted/50 border p-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">True branch:</span> Executes when condition is met<br />
            <span className="font-medium">False branch:</span> Executes when condition is not met
          </p>
        </div>
        {renderNotesField()}
      </div>
    );
  };

  const handleSaveSchedule = async () => {
    setIsSavingSchedule(true);
    setCronError(null);
    setPriceError(null);

    try {
      if (scheduleTriggerMode === 'SCHEDULE') {
        const cronExprToSave = schedulePreset;

        // Basic client-side validation
        const validation = validateMinimumIntervalClient(cronExprToSave);
        if (!validation.valid) {
          setCronError(validation.error || 'Invalid cron expression');
          setIsSavingSchedule(false);
          return;
        }

        const result = await updateAutomationSchedule(
          automationId,
          scheduleTriggerMode,
          cronExprToSave
        );

        if (!result.success) {
          setCronError(result.error || 'Failed to save schedule');
          setIsSavingSchedule(false);
          return;
        }

        onScheduleUpdate(scheduleTriggerMode, cronExprToSave, null);
        toast.success('Schedule saved successfully');
      } else if (scheduleTriggerMode === 'PRICE_TRIGGER') {
        // Validate price trigger inputs
        if (!priceLpAddress || priceLpAddress.trim() === '') {
          setPriceError('LP address is required');
          setIsSavingSchedule(false);
          return;
        }

        if (!/^0x[a-fA-F0-9]{40}$/.test(priceLpAddress)) {
          setPriceError('Invalid LP address format');
          setIsSavingSchedule(false);
          return;
        }

        const priceValueNum = parseFloat(priceValue);
        if (isNaN(priceValueNum) || priceValueNum <= 0) {
          setPriceError('Price value must be a positive number');
          setIsSavingSchedule(false);
          return;
        }

        const cooldownNum = parseInt(priceCooldown) || 15;
        if (cooldownNum < 1 || cooldownNum > 1440) {
          setPriceError('Cooldown must be between 1 and 1440 minutes');
          setIsSavingSchedule(false);
          return;
        }

        const result = await updateAutomationPriceTrigger(
          automationId,
          priceLpAddress,
          priceOperator,
          priceValueNum,
          cooldownNum
        );

        if (!result.success) {
          setPriceError(result.error || 'Failed to save price trigger');
          setIsSavingSchedule(false);
          return;
        }

        onScheduleUpdate(scheduleTriggerMode, null, null);
        if (onPriceTriggerUpdate) {
          onPriceTriggerUpdate(priceLpAddress, priceOperator, priceValueNum, cooldownNum);
        }
        toast.success('Price trigger saved successfully');
      } else {
        // MANUAL mode - just update trigger mode
        const result = await updateAutomationSchedule(
          automationId,
          scheduleTriggerMode,
          null
        );

        if (!result.success) {
          setCronError(result.error || 'Failed to save');
          setIsSavingSchedule(false);
          return;
        }

        onScheduleUpdate(scheduleTriggerMode, null, null);
        toast.success('Saved successfully');
      }

      onOpenChange(false);
    } catch (error) {
      setCronError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // Get all variable nodes from the flow (for showing in selects)
  const getVariableNodes = () => {
    return nodes
      .filter((n) => {
        if (n.type !== 'variable') return false;
        const data = n.data as { config?: { variableName?: string } } | undefined;
        return data?.config?.variableName;
      })
      .map((n) => ({
        id: n.id,
        name: ((n.data as { config?: { variableName?: string } })?.config?.variableName) || '',
      }));
  };

  const renderVariableConfig = () => {
    const sourceType = formData.sourceType || 'previousOutput';
    const previousOutputFields = getPreviousOutputFields();
    const hasPreviousNode = previousNodeType !== null;

    return (
      <div className="grid flex-1 auto-rows-min gap-6 px-4">
        <div className="grid gap-3">
          <label htmlFor="variableName" className="text-sm font-medium">Variable Name</label>
          <Input
            id="variableName"
            type="text"
            placeholder="myVariable"
            value={formData.variableName || ''}
            onChange={(e) => {
              // Only allow alphanumeric and underscore
              const value = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
              updateField('variableName', value);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Use letters, numbers, and underscores. Access as ${'{'}${formData.variableName || 'name'}{'}'} in calculator.
          </p>
        </div>

        <div className="grid gap-3">
          <label className="text-sm font-medium">Source</label>
          <Select
            value={sourceType}
            onValueChange={(value) => updateField('sourceType', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="static">Static Value</SelectItem>
              <SelectItem value="previousOutput" disabled={!hasPreviousNode || previousOutputFields.length === 0}>
                Previous Output {!hasPreviousNode ? '(no previous node)' : previousOutputFields.length === 0 ? '(no outputs)' : ''}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {sourceType === 'static' && (
          <div className="grid gap-3">
            <label htmlFor="staticValue" className="text-sm font-medium">Value</label>
            <Input
              id="staticValue"
              type="text"
              placeholder="100"
              value={formData.staticValue || ''}
              onChange={(e) => updateField('staticValue', e.target.value)}
            />
          </div>
        )}

        {sourceType === 'previousOutput' && previousOutputFields.length > 0 && (
          <div className="grid gap-3">
            <label className="text-sm font-medium">Output Field</label>
            <Select
              value={formData.outputField || previousOutputFields[0]?.value}
              onValueChange={(value) => updateField('outputField', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {previousOutputFields.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {renderNotesField()}
      </div>
    );
  };

  const renderCalculatorConfig = () => {
    const variableNodes = getVariableNodes();

    return (
      <div className="grid flex-1 auto-rows-min gap-6 px-4">
        <div className="grid gap-3">
          <label htmlFor="expression" className="text-sm font-medium">Expression</label>
          <Textarea
            id="expression"
            placeholder="3 + 4 * 2 / (1 - 5)"
            value={formData.expression || ''}
            onChange={(e) => updateField('expression', e.target.value)}
            rows={4}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Enter a math expression. Use {'{{variableName}}'} to reference variables.
          </p>
        </div>

        {variableNodes.length > 0 && (
          <div className="rounded-lg bg-muted/50 border p-3">
            <p className="text-xs font-medium mb-2">Available Variables</p>
            <div className="flex flex-wrap gap-2">
              {variableNodes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    const currentExpr = formData.expression || '';
                    updateField('expression', currentExpr + `{{${v.name}}}`);
                  }}
                  className="text-xs font-mono bg-emerald-500/20 text-emerald-500 px-2 py-1 rounded hover:bg-emerald-500/30 transition-colors"
                >
                  {'{{' + v.name + '}}'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg bg-muted/50 border p-3">
          <p className="text-xs font-medium mb-2">Supported Operations</p>
          <div className="text-xs text-muted-foreground space-y-1 font-mono">
            <p>+ - Addition</p>
            <p>- - Subtraction</p>
            <p>* - Multiplication</p>
            <p>/ - Division</p>
            <p>( ) - Parentheses</p>
            <p>** - Power (e.g., 2**3 = 8)</p>
            <p>% - Modulo</p>
          </div>
        </div>

        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3">
          <p className="text-xs text-cyan-400">
            The result will be available as previousOutput for the next node.
          </p>
        </div>

        {renderNotesField()}
      </div>
    );
  };

  const renderTelegramConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-4">
        <p className="text-sm text-sky-400">
          Make sure you&apos;ve connected your Telegram account before using this node.
        </p>
        <a
          href="/connect/telegram"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
        >
          Connect Telegram
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="grid gap-3">
        <label htmlFor="message" className="text-sm font-medium">Message Template</label>
        <Textarea
          id="message"
          placeholder="Your automation {{automation.name}} has completed!"
          value={formData.message || ''}
          onChange={(e) => updateField('message', e.target.value)}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          Use variables like {`{{automation.name}}`}, {`{{timestamp}}`}, {`{{previousNode.output}}`}
        </p>
      </div>

      <div className="rounded-lg bg-muted/50 border p-3">
        <p className="text-xs font-medium mb-2">Available Variables</p>
        <div className="text-xs text-muted-foreground space-y-1 font-mono">
          <p>{`{{automation.name}}`} - Automation name</p>
          <p>{`{{automation.id}}`} - Automation ID</p>
          <p>{`{{timestamp}}`} - Current timestamp</p>
          <p>{`{{previousNode.output}}`} - Previous node output</p>
          <p>{`{{previousNode.txHash}}`} - Previous tx hash</p>
          <p>{`{{balance.pls}}`} - Current PLS balance</p>
        </div>
      </div>
      {renderNotesField()}
    </div>
  );

  const renderStartConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <div className="grid gap-3">
        <label className="text-sm font-medium">Trigger Mode</label>
        <Select
          value={scheduleTriggerMode}
          onValueChange={(value: 'MANUAL' | 'SCHEDULE' | 'PRICE_TRIGGER') => {
            if ((value === 'SCHEDULE' || value === 'PRICE_TRIGGER') && !isPro) return;
            setScheduleTriggerMode(value);
            setCronError(null);
            setPriceError(null);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MANUAL">Manual Start</SelectItem>
            <SelectItem value="SCHEDULE" disabled={!isPro}>
              <div className="flex items-center gap-2">
                Scheduled
                {!isPro && <LockClosedIcon className="h-3 w-3 text-muted-foreground" />}
              </div>
            </SelectItem>
            <SelectItem value="PRICE_TRIGGER" disabled={!isPro}>
              <div className="flex items-center gap-2">
                Price Trigger
                {!isPro && <LockClosedIcon className="h-3 w-3 text-muted-foreground" />}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {scheduleTriggerMode === 'MANUAL'
            ? 'Run this automation manually using the play button'
            : scheduleTriggerMode === 'SCHEDULE'
              ? 'Automatically run this automation on a schedule'
              : 'Trigger when LP price meets your condition'}
        </p>
      </div>

      {!isPro && (
        <div className="rounded-lg bg-muted/50 border p-3">
          <div className="flex items-center gap-2 text-sm">
            <LockClosedIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Pro Feature</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Upgrade to Pro to use scheduled and price-triggered automations.
          </p>
        </div>
      )}

      {scheduleTriggerMode === 'SCHEDULE' && isPro && (
        <>
          <div className="grid gap-3">
            <label className="text-sm font-medium">Schedule</label>
            <Select
              value={schedulePreset}
              onValueChange={(value) => {
                setShowAdvanced(false);
                setSchedulePreset(value);
                setCronError(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {cronError && (
            <p className="text-xs text-destructive">{cronError}</p>
          )}
        </>
      )}

      {scheduleTriggerMode === 'PRICE_TRIGGER' && isPro && (
        <>
          <div className="grid gap-3">
            <label htmlFor="priceLpAddress" className="text-sm font-medium">TOKEN/WPLS LP Pair Address</label>
            <TokenCommandInput
              value={priceLpAddress}
              onChange={setPriceLpAddress}
              expectedType="lp"
              placeholder="Select LP pair..."
              className={priceError && priceError.includes('LP address') ? 'border-destructive' : ''}
            />
            <p className="text-xs text-muted-foreground">
              Enter a TOKEN/WPLS liquidity pair address from PulseX
            </p>
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-medium">Trigger when price is</label>
            <div className="flex gap-2 items-center">
              <Select
                value={priceOperator}
                onValueChange={(value) => setPriceOperator(value)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="<">Less than</SelectItem>
                  <SelectItem value=">">Greater than</SelectItem>
                  <SelectItem value="<=">Less or equal</SelectItem>
                  <SelectItem value=">=">Greater or equal</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="text"
                  placeholder="0.50"
                  value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                  className={`pl-7 ${priceError && priceError.includes('Price value') ? 'border-destructive' : ''}`}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              USD price per token (calculated from WPLS/DAI LP on-chain)
            </p>
          </div>

          <div className="grid gap-3">
            <label htmlFor="priceCooldown" className="text-sm font-medium">Cooldown (minutes)</label>
            <Input
              id="priceCooldown"
              type="number"
              placeholder="15"
              min={1}
              max={1440}
              value={priceCooldown}
              onChange={(e) => setPriceCooldown(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Minimum time between triggers (1-1440 minutes). Prevents repeated triggers.
            </p>
          </div>

          {/* <div className="rounded-lg bg-muted/50 border p-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">How it works:</span> Every ~20 minutes, we calculate the token&apos;s USD price 
              using on-chain LP reserves (TOKEN/WPLS × PLS/DAI). If your condition is met and the cooldown has passed, 
              your automation triggers.
            </p>
          </div> */}

          {priceError && (
            <p className="text-xs text-destructive">{priceError}</p>
          )}
        </>
      )}
    </div>
  );

  // Helper component for Notes field (no padding, will be inside config divs)
  const renderNotesField = () => (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <label htmlFor="notes" className="text-sm font-medium">Notes</label>
        <Textarea
          id="notes"
          placeholder="Add a note (max 50 characters)"
          value={formData.notes || ''}
          onChange={(e) => {
            const value = e.target.value.slice(0, 50);
            updateField('notes', value);
          }}
          maxLength={50}
          rows={2}
          className="resize-none"
        />
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">Optional note to help identify this node</p>
          <p className="text-xs text-muted-foreground">
            {(formData.notes || '').length}/50
          </p>
        </div>
      </div>
    </div>
  );

  const renderDexQuoteConfig = () => {
    const quoteMode = formData.quoteMode || 'amountsOut';
    return (
      <div className="grid flex-1 auto-rows-min gap-6 px-4">
        <div className="grid gap-3">
          <label className="text-sm font-medium">Quote Mode</label>
          <Select
            value={quoteMode}
            onValueChange={(value) => updateField('quoteMode', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="amountsIn">Amounts In (how much input needed)</SelectItem>
              <SelectItem value="amountsOut">Amounts Out (how much output received)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {quoteMode === 'amountsIn'
              ? 'Calculate how much input token is needed to receive the specified output amount'
              : 'Calculate how much output token you receive for the specified input amount'}
          </p>
        </div>
        <AmountSelector
          value={formData.amount}
          onChange={(value) => updateField('amount', value)}
          previousNodeType={previousNodeType}
          previousNodeConfig={previousNodeConfig}
          label="Amount"
          fieldName="amount"
          nodeType="dexQuote"
          formData={formData}
          nodes={nodes}
        />
        <div className="grid gap-3">
          <label className="text-sm font-medium">Token Path</label>
          {validation.hardErrors.path && (
            <p className="text-xs text-destructive">{validation.hardErrors.path}</p>
          )}
          <div className="space-y-2">
            {(formData.path || []).map((item: string, index: number) => (
              <PathTokenInput
                key={index}
                address={item}
                idx={index}
                onUpdate={(value) => updateArrayField('path', index, value)}
                onRemove={() => removeArrayItem('path', index)}
                hardError={validation.hardErrors[`path[${index}]`]}
                allowForEachItem={isInsideForEach}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addArrayItem('path')}
            className="w-full"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Token
          </Button>
        </div>
        {renderNotesField()}
      </div>
    );
  };

  const renderConfig = () => {
    switch (nodeType) {
      case 'start':
        return renderStartConfig();
      case 'swap':
        return renderSwapConfig();
      case 'swapFromPLS':
        return renderSwapFromPLSConfig();
      case 'swapToPLS':
        return renderSwapToPLSConfig();
      case 'transfer':
        return renderTransferConfig();
      case 'transferPLS':
        return renderTransferPLSConfig();
      case 'addLiquidity':
        return renderAddLiquidityConfig();
      case 'addLiquidityPLS':
        return renderAddLiquidityPLSConfig();
      case 'removeLiquidity':
        return renderRemoveLiquidityConfig();
      case 'removeLiquidityPLS':
        return renderRemoveLiquidityPLSConfig();
      case 'burnToken':
        return renderBurnTokenConfig();
      case 'claimToken':
        return renderClaimTokenConfig();
      case 'getParent':
        return renderGetParentConfig();
      case 'checkLPTokenAmounts':
        return renderCheckLPTokenAmountsConfig();
      case 'wait':
        return renderWaitConfig();
      case 'checkTokenBalance':
        return renderCheckTokenBalanceConfig();
      case 'loop':
        return renderLoopConfig();
      case 'gasGuard':
        return renderGasGuardConfig();
      case 'condition':
        return renderConditionConfig();
      case 'telegram':
        return renderTelegramConfig();
      case 'variable':
        return renderVariableConfig();
      case 'calculator':
        return renderCalculatorConfig();
      case 'dexQuote':
        return renderDexQuoteConfig();
      case 'forEach':
        return renderForEachConfig();
      case 'endForEach':
        return renderEndForEachConfig();
      case 'checkBalance':
      default:
        return (
          <div className="grid flex-1 auto-rows-min gap-6 px-4">
            <div className="py-6 text-sm text-muted-foreground">
              No configuration needed for this node type.
            </div>
            {renderNotesField()}
          </div>
        );
    }
  };

  if (!nodeType) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="md:max-w-xl flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Configure {nodeType}</SheetTitle>
            <SheetDescription>
              Set the parameters for this node
            </SheetDescription>
          </SheetHeader>
          {renderConfig()}
        </div>
        <SheetFooter className="flex-col gap-2 border-t pt-3!">
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              className="w-full"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          <SheetClose asChild>
            <Button variant="outline" className="w-full">Cancel</Button>
          </SheetClose>
          <Button
            type="submit"
            onClick={nodeType === 'start' ? handleSaveSchedule : handleSave}
            className="w-full"
            disabled={(nodeType === 'start' && isSavingSchedule) || (!validation.isValid && nodeType !== 'start') || validation.isLoading}
          >
            {nodeType === 'start' && isSavingSchedule
              ? 'Saving...'
              : validation.isLoading
                ? 'Validating...'
                : !validation.isValid && nodeType !== 'start'
                  ? 'Fix errors to save'
                  : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
