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
import { PlusIcon, XMarkIcon, TrashIcon, LockClosedIcon } from '@heroicons/react/24/solid';
import { ExternalLink } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { NodeType } from '@/components/select-node-dialog';
import { SlippageSelector } from '@/components/slippage-selector';
import { AmountSelector } from '@/components/amount-selector';
import type { Node, Edge } from '@xyflow/react';
import { CONFIG } from '@/lib/config';
import { SCHEDULE_PRESETS, validateMinimumIntervalClient } from '@/lib/cron-utils';
import { updateAutomationSchedule } from '@/lib/actions/automations';
import { toast } from 'sonner';
import { useTokenInfo } from '@/components/hooks/useTokenInfo';
import { useNodeValidation } from '@/components/hooks/useNodeValidation';

// Helper component for address inputs with validation and token name
function AddressInput({
  id,
  value,
  onChange,
  placeholder = '0x...',
  label,
  fieldName,
  hardError,
  softWarning,
  showTokenName = true,
  expectedType,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  label?: string;
  fieldName: string;
  hardError?: string;
  softWarning?: string;
  showTokenName?: boolean;
  expectedType?: 'token' | 'lp';
}) {
  const tokenInfo = useTokenInfo(value, expectedType);

  const borderClass = hardError
    ? 'border-destructive'
    : softWarning || (expectedType && tokenInfo.isLP !== null && tokenInfo.isToken !== null && 
        ((expectedType === 'token' && tokenInfo.isLP) || (expectedType === 'lp' && tokenInfo.isToken && !tokenInfo.isLP)))
    ? 'border-yellow-500'
    : '';

  const typeMismatchWarning = expectedType && tokenInfo.isLP !== null && tokenInfo.isToken !== null && 
    ((expectedType === 'token' && tokenInfo.isLP) || (expectedType === 'lp' && tokenInfo.isToken && !tokenInfo.isLP))
    ? expectedType === 'token' 
      ? 'This is an LP pair address. Token address required.'
      : 'This is a token address. LP pair address required.'
    : null;

  return (
    <div className="grid gap-3">
      {label && <label htmlFor={id} className="text-sm font-medium">{label}</label>}
      <div className="space-y-1">
        <Input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={borderClass}
        />
        {showTokenName && tokenInfo.name && (
          <p className="text-xs text-muted-foreground">{tokenInfo.name}</p>
        )}
        {tokenInfo.isLoading && (
          <p className="text-xs text-muted-foreground">Loading token info...</p>
        )}
        {typeMismatchWarning && !hardError && (
          <p className="text-xs text-yellow-600">{typeMismatchWarning}</p>
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
  triggerMode: 'MANUAL' | 'SCHEDULE';
  cronExpression: string | null;
  onScheduleUpdate: (triggerMode: 'MANUAL' | 'SCHEDULE', cronExpression: string | null, nextRunAt: Date | null) => void;
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

  // Schedule state for start node
  const [scheduleTriggerMode, setScheduleTriggerMode] = useState<'MANUAL' | 'SCHEDULE'>(triggerMode);
  const [schedulePreset, setSchedulePreset] = useState<string>(
    SCHEDULE_PRESETS.find((p) => p.value === cronExpression)?.value || SCHEDULE_PRESETS[0].value
  );
  const [customCronExpression, setCustomCronExpression] = useState(cronExpression || '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cronError, setCronError] = useState<string | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

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
  }, [triggerMode, cronExpression]);

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
    setFormData((prev) => ({ ...prev, [field]: value }));
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

  // PathTokenInput component for swap path arrays
  const PathTokenInput = ({ address, idx, onUpdate, onRemove }: { 
    address: string; 
    idx: number;
    onUpdate: (value: string) => void;
    onRemove: () => void;
  }) => {
    const info = useTokenInfo(address, 'token');
    const typeMismatch = info.isLP === true;
    const hasError = validation.hardErrors[`path[${idx}]`];
    const borderClass = hasError
      ? 'border-destructive'
      : typeMismatch
      ? 'border-yellow-500'
      : '';
    
    return (
      <div className="space-y-1">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="0x..."
            value={address}
            onChange={(e) => onUpdate(e.target.value)}
            className={borderClass}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRemove}
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        </div>
        {info.name && <p className="text-xs text-muted-foreground">{info.name}</p>}
        {info.isLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
        {typeMismatch && !hasError && (
          <p className="text-xs text-yellow-600">LP pair address not allowed in token path</p>
        )}
        {hasError && (
          <p className="text-xs text-destructive">{hasError}</p>
        )}
      </div>
    );
  };

  const renderSwapConfig = () => {
    const swapMode = formData.swapMode || 'exactIn';
    return (
      <div className="grid flex-1 auto-rows-min gap-6 px-4">
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
      </div>
    );
  };

  const renderSwapFromPLSConfig = () => {
    const swapMode = formData.swapMode || 'exactIn';
    return (
      <div className="grid flex-1 auto-rows-min gap-6 px-4">
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
        />
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
      </div>
    );
  };

  const renderSwapToPLSConfig = () => {
    const swapMode = formData.swapMode || 'exactIn';
    return (
      <div className="grid flex-1 auto-rows-min gap-6 px-4">
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
        />
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
      </div>
    );
  };

  const renderTransferConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="token"
        value={formData.token || ''}
        onChange={(e) => updateField('token', e.target.value)}
        label="Token Address"
        fieldName="token"
        hardError={validation.hardErrors.token}
        softWarning={validation.softWarnings.token}
        expectedType="token"
      />
      <AddressInput
        id="to"
        value={formData.to || ''}
        onChange={(e) => updateField('to', e.target.value)}
        label="To Address"
        fieldName="to"
        hardError={validation.hardErrors.to}
        showTokenName={false}
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
      />
    </div>
  );

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
      />
    </div>
  );

  const renderAddLiquidityConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="tokenA"
        value={formData.tokenA || ''}
        onChange={(e) => updateField('tokenA', e.target.value)}
        label="Token A Address"
        fieldName="tokenA"
        hardError={validation.hardErrors.tokenA}
        softWarning={validation.softWarnings.tokenA}
        expectedType="token"
      />
      <AddressInput
        id="tokenB"
        value={formData.tokenB || ''}
        onChange={(e) => updateField('tokenB', e.target.value)}
        label="Token B Address"
        fieldName="tokenB"
        hardError={validation.hardErrors.tokenB}
        softWarning={validation.softWarnings.tokenB}
        expectedType="token"
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
      />
      <SlippageSelector
        value={formData.slippage ?? 0.01}
        onChange={(value) => updateField('slippage', value)}
      />
    </div>
  );

  const renderAddLiquidityPLSConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="token"
        value={formData.token || ''}
        onChange={(e) => updateField('token', e.target.value)}
        label="Token Address"
        fieldName="token"
        hardError={validation.hardErrors.token}
        softWarning={validation.softWarnings.token}
        expectedType="token"
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
      />
      <SlippageSelector
        value={formData.slippage ?? 0.01}
        onChange={(value) => updateField('slippage', value)}
      />
    </div>
  );

  const renderRemoveLiquidityConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="tokenA"
        value={formData.tokenA || ''}
        onChange={(e) => updateField('tokenA', e.target.value)}
        label="Token A Address"
        fieldName="tokenA"
        hardError={validation.hardErrors.tokenA}
        softWarning={validation.softWarnings.tokenA}
        expectedType="token"
      />
      <AddressInput
        id="tokenB"
        value={formData.tokenB || ''}
        onChange={(e) => updateField('tokenB', e.target.value)}
        label="Token B Address"
        fieldName="tokenB"
        hardError={validation.hardErrors.tokenB}
        softWarning={validation.softWarnings.tokenB}
        expectedType="token"
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
      />
      <SlippageSelector
        value={formData.slippage ?? 0.01}
        onChange={(value) => updateField('slippage', value)}
      />
    </div>
  );

  const renderRemoveLiquidityPLSConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="token"
        value={formData.token || ''}
        onChange={(e) => updateField('token', e.target.value)}
        label="Token Address"
        fieldName="token"
        hardError={validation.hardErrors.token}
        softWarning={validation.softWarnings.token}
        expectedType="token"
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
      />
      <SlippageSelector
        value={formData.slippage ?? 0.01}
        onChange={(value) => updateField('slippage', value)}
      />
    </div>
  );

  const renderBurnTokenConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="token"
        value={formData.token || ''}
        onChange={(e) => updateField('token', e.target.value)}
        label="Token Address"
        fieldName="token"
        hardError={validation.hardErrors.token}
        softWarning={validation.softWarnings.token}
        expectedType="token"
      />
      <AmountSelector
        value={formData.amount}
        onChange={(value) => updateField('amount', value)}
        previousNodeType={previousNodeType}
        previousNodeConfig={previousNodeConfig}
        label="Amount"
        fieldName="amount"
        nodeType="burnToken"
        formData={formData}
      />
    </div>
  );

  const renderClaimTokenConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="token"
        value={formData.token || ''}
        onChange={(e) => updateField('token', e.target.value)}
        label="Token Address"
        fieldName="token"
        hardError={validation.hardErrors.token}
        softWarning={validation.softWarnings.token}
        expectedType="token"
      />
      <AmountSelector
        value={formData.amount}
        onChange={(value) => updateField('amount', value)}
        previousNodeType={previousNodeType}
        previousNodeConfig={previousNodeConfig}
        label="Amount"
        fieldName="amount"
        nodeType="claimToken"
        formData={formData}
      />
    </div>
  );

  const renderCheckLPTokenAmountsConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="pairAddress"
        value={formData.pairAddress || ''}
        onChange={(e) => updateField('pairAddress', e.target.value)}
        label="Pair Address"
        fieldName="pairAddress"
        hardError={validation.hardErrors.pairAddress}
        softWarning={validation.softWarnings.pairAddress}
        expectedType="lp"
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
    </div>
  );

  const renderCheckTokenBalanceConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AddressInput
        id="token"
        value={formData.token || ''}
        onChange={(e) => updateField('token', e.target.value)}
        label="Token Contract Address"
        fieldName="token"
        hardError={validation.hardErrors.token}
        softWarning={validation.softWarnings.token}
      />
      <p className="text-xs text-muted-foreground px-4">The ERC20 token contract address to check balance for</p>
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
          max={3}
          value={formData.loopCount || ''}
          onChange={(e) => updateField('loopCount', Math.min(3, Math.max(1, parseInt(e.target.value) || 1)))}
          className={validation.hardErrors.loopCount ? 'border-destructive' : validation.softWarnings.loopCount ? 'border-yellow-500' : ''}
        />
        <p className="text-xs text-muted-foreground">Number of times to restart the automation (1-3). Loops back to start node.</p>
        {validation.hardErrors.loopCount && (
          <p className="text-xs text-destructive">{validation.hardErrors.loopCount}</p>
        )}
        {validation.softWarnings.loopCount && (
          <p className="text-xs text-yellow-600">{validation.softWarnings.loopCount}</p>
        )}
      </div>
    </div>
  );

  const renderGasGuardConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <div className="grid gap-3">
        <label htmlFor="maxGasPrice" className="text-sm font-medium">Max Gas Price (Gwei)</label>
        <Input
          id="maxGasPrice"
          type="number"
          placeholder="100"
          value={formData.maxGasPrice || ''}
          onChange={(e) => updateField('maxGasPrice', e.target.value)}
          className={validation.hardErrors.maxGasPrice ? 'border-destructive' : validation.softWarnings.maxGasPrice ? 'border-yellow-500' : ''}
        />
        <p className="text-xs text-muted-foreground">Maximum gas price in Gwei. Automation will stop if gas exceeds this value.</p>
        {validation.hardErrors.maxGasPrice && (
          <p className="text-xs text-destructive">{validation.hardErrors.maxGasPrice}</p>
        )}
        {validation.softWarnings.maxGasPrice && (
          <p className="text-xs text-yellow-600">{validation.softWarnings.maxGasPrice}</p>
        )}
      </div>
    </div>
  );

  // Get available output fields from previous node type
  const getPreviousOutputFields = () => {
    if (!previousNodeType) return [];

    const outputFields: { value: string; label: string }[] = [];

    switch (previousNodeType) {
      case 'swap':
      case 'swapFromPLS':
      case 'swapToPLS':
        outputFields.push({ value: 'amountOut', label: 'Amount Out (tokens received)' });
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
            onChange={(e) => updateField('tokenAddress', e.target.value)}
            label="Token Address"
            fieldName="tokenAddress"
            hardError={validation.hardErrors.tokenAddress}
            softWarning={validation.softWarnings.tokenAddress}
            expectedType="token"
          />
        )}

        {showPairAddress && (
          <AddressInput
            id="lpPairAddress"
            value={formData.lpPairAddress || ''}
            onChange={(e) => updateField('lpPairAddress', e.target.value)}
            label="LP Pair Address"
            fieldName="lpPairAddress"
            hardError={validation.hardErrors.lpPairAddress}
            softWarning={validation.softWarnings.lpPairAddress}
            expectedType="lp"
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
      </div>
    );
  };

  const handleSaveSchedule = async () => {
    setIsSavingSchedule(true);
    setCronError(null);

    try {
      let cronExprToSave: string | null = null;

      if (scheduleTriggerMode === 'SCHEDULE') {
        cronExprToSave = schedulePreset;

        // Basic client-side validation
        const validation = validateMinimumIntervalClient(cronExprToSave);
        if (!validation.valid) {
          setCronError(validation.error || 'Invalid cron expression');
          setIsSavingSchedule(false);
          return;
        }
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

      // Server calculates nextRunAt, we just update local state
      onScheduleUpdate(scheduleTriggerMode, cronExprToSave, null);
      toast.success('Schedule saved successfully');
      onOpenChange(false);
    } catch (error) {
      setCronError(error instanceof Error ? error.message : 'Failed to save schedule');
    } finally {
      setIsSavingSchedule(false);
    }
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
    </div>
  );

  const renderStartConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <div className="grid gap-3">
        <label className="text-sm font-medium">Trigger Mode</label>
        <Select
          value={scheduleTriggerMode}
          onValueChange={(value: 'MANUAL' | 'SCHEDULE') => {
            if (value === 'SCHEDULE' && !isPro) return;
            setScheduleTriggerMode(value);
            setCronError(null);
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
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {scheduleTriggerMode === 'MANUAL'
            ? 'Run this automation manually using the play button'
            : 'Automatically run this automation on a schedule'}
        </p>
      </div>

      {!isPro && (
        <div className="rounded-lg bg-muted/50 border p-3">
          <div className="flex items-center gap-2 text-sm">
            <LockClosedIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Pro Feature</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Upgrade to Pro to schedule your automations to run automatically.
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
    </div>
  );

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
      case 'checkBalance':
      default:
        return (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No configuration needed for this node type.
          </div>
        );
    }
  };

  if (!nodeType) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Configure {nodeType}</SheetTitle>
          <SheetDescription>
            Set the parameters for this node
          </SheetDescription>
        </SheetHeader>
        {renderConfig()}
        <SheetFooter className="flex-col gap-2">
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
