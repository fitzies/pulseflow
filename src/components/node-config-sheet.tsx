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
import { Plus, X, Trash2 } from 'lucide-react';
import type { NodeType } from '@/components/select-node-dialog';
import { SlippageSelector } from '@/components/slippage-selector';
import { AmountSelector } from '@/components/amount-selector';
import type { Node, Edge } from '@xyflow/react';
import { CONFIG } from '@/lib/config';

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

  useEffect(() => {
    if (config) {
      setFormData(config);
    } else {
      setFormData({});
    }
  }, [config, nodeType]);

  const handleSave = () => {
    if (!nodeId) return;
    
    // Auto-prepend WPLS to swapPLS path if not already present
    let configToSave = { ...formData };
    if (nodeType === 'swapPLS' && configToSave.path && Array.isArray(configToSave.path)) {
      const path = configToSave.path as string[];
      if (path.length === 0 || path[0]?.toLowerCase() !== CONFIG.wpls.toLowerCase()) {
        configToSave = {
          ...configToSave,
          path: [CONFIG.wpls, ...path],
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

  const canDelete = nodeType !== 'start' && onDelete;

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

  const renderSwapConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AmountSelector
        value={formData.amountIn}
        onChange={(value) => updateField('amountIn', value)}
        previousNodeType={previousNodeType}
        previousNodeConfig={previousNodeConfig}
        label="Amount In"
        fieldName="amountIn"
        nodeType="swap"
        formData={formData}
      />
      <div className="grid gap-3">
        <label className="text-sm font-medium">Token Path</label>
        <div className="space-y-2">
          {(formData.path || []).map((item: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                type="text"
                placeholder="0x..."
                value={item}
                onChange={(e) => updateArrayField('path', index, e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeArrayItem('path', index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addArrayItem('path')}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Token
        </Button>
      </div>
      <SlippageSelector
        value={formData.slippage ?? 0.01}
        onChange={(value) => updateField('slippage', value)}
      />
    </div>
  );

  const renderSwapPLSConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <AmountSelector
        value={formData.plsAmount}
        onChange={(value) => updateField('plsAmount', value)}
        previousNodeType={previousNodeType}
        previousNodeConfig={previousNodeConfig}
        label="PLS Amount"
        fieldName="plsAmount"
        nodeType="swapPLS"
        formData={formData}
        isPLSAmount={true}
      />
      <div className="grid gap-3">
        <label className="text-sm font-medium">Token Path</label>
        <div className="text-xs text-muted-foreground mb-2">
          WPLS will be automatically added as the first token in the path
        </div>
        <div className="space-y-2">
          {(formData.path || []).map((item: string, index: number) => (
            <div key={index} className="flex gap-2">
              <Input
                type="text"
                placeholder="0x..."
                value={item}
                onChange={(e) => updateArrayField('path', index, e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeArrayItem('path', index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addArrayItem('path')}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Token
        </Button>
      </div>
      <SlippageSelector
        value={formData.slippage ?? 0.01}
        onChange={(value) => updateField('slippage', value)}
      />
    </div>
  );

  const renderTransferConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <div className="grid gap-3">
        <label htmlFor="token" className="text-sm font-medium">Token Address</label>
        <Input
          id="token"
          type="text"
          placeholder="0x..."
          value={formData.token || ''}
          onChange={(e) => updateField('token', e.target.value)}
        />
      </div>
      <div className="grid gap-3">
        <label htmlFor="to" className="text-sm font-medium">To Address</label>
        <Input
          id="to"
          type="text"
          placeholder="0x..."
          value={formData.to || ''}
          onChange={(e) => updateField('to', e.target.value)}
        />
      </div>
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

  const renderAddLiquidityConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <div className="grid gap-3">
        <label htmlFor="tokenA" className="text-sm font-medium">Token A Address</label>
        <Input
          id="tokenA"
          type="text"
          placeholder="0x..."
          value={formData.tokenA || ''}
          onChange={(e) => updateField('tokenA', e.target.value)}
        />
      </div>
      <div className="grid gap-3">
        <label htmlFor="tokenB" className="text-sm font-medium">Token B Address</label>
        <Input
          id="tokenB"
          type="text"
          placeholder="0x..."
          value={formData.tokenB || ''}
          onChange={(e) => updateField('tokenB', e.target.value)}
        />
      </div>
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
      <div className="grid gap-3">
        <label htmlFor="token" className="text-sm font-medium">Token Address</label>
        <Input
          id="token"
          type="text"
          placeholder="0x..."
          value={formData.token || ''}
          onChange={(e) => updateField('token', e.target.value)}
        />
      </div>
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
      <div className="grid gap-3">
        <label htmlFor="tokenA" className="text-sm font-medium">Token A Address</label>
        <Input
          id="tokenA"
          type="text"
          placeholder="0x..."
          value={formData.tokenA || ''}
          onChange={(e) => updateField('tokenA', e.target.value)}
        />
      </div>
      <div className="grid gap-3">
        <label htmlFor="tokenB" className="text-sm font-medium">Token B Address</label>
        <Input
          id="tokenB"
          type="text"
          placeholder="0x..."
          value={formData.tokenB || ''}
          onChange={(e) => updateField('tokenB', e.target.value)}
        />
      </div>
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
      <div className="grid gap-3">
        <label htmlFor="token" className="text-sm font-medium">Token Address</label>
        <Input
          id="token"
          type="text"
          placeholder="0x..."
          value={formData.token || ''}
          onChange={(e) => updateField('token', e.target.value)}
        />
      </div>
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
      <div className="grid gap-3">
        <label htmlFor="token" className="text-sm font-medium">Token Address</label>
        <Input
          id="token"
          type="text"
          placeholder="0x..."
          value={formData.token || ''}
          onChange={(e) => updateField('token', e.target.value)}
        />
      </div>
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
      <div className="grid gap-3">
        <label htmlFor="token" className="text-sm font-medium">Token Address</label>
        <Input
          id="token"
          type="text"
          placeholder="0x..."
          value={formData.token || ''}
          onChange={(e) => updateField('token', e.target.value)}
        />
      </div>
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
      <div className="grid gap-3">
        <label htmlFor="pairAddress" className="text-sm font-medium">Pair Address</label>
        <Input
          id="pairAddress"
          type="text"
          placeholder="0x..."
          value={formData.pairAddress || ''}
          onChange={(e) => updateField('pairAddress', e.target.value)}
        />
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
          value={formData.delay || ''}
          onChange={(e) => updateField('delay', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Delay in seconds before executing next node</p>
      </div>
    </div>
  );

  const renderCheckTokenBalanceConfig = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <div className="grid gap-3">
        <label htmlFor="token" className="text-sm font-medium">Token Contract Address</label>
        <Input
          id="token"
          type="text"
          placeholder="0x..."
          value={formData.token || ''}
          onChange={(e) => updateField('token', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">The ERC20 token contract address to check balance for</p>
      </div>
    </div>
  );

  const renderConfig = () => {
    switch (nodeType) {
      case 'swap':
        return renderSwapConfig();
      case 'swapPLS':
        return renderSwapPLSConfig();
      case 'transfer':
        return renderTransferConfig();
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
      <SheetContent>
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
              variant="destructive"
              onClick={handleDelete}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Node
            </Button>
          )}
          <SheetClose asChild>
            <Button variant="outline" className="w-full">Cancel</Button>
          </SheetClose>
          <Button type="submit" onClick={handleSave} className="w-full">
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
