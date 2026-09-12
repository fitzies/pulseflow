import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { ContractTransactionResponse, Interface, JsonRpcProvider, MaxUint256, type Wallet } from 'ethers';
import { CONFIG } from './config';
import { PulseXSwapRouter } from './abis';
import { executePulseXSmartSwap, findBestPath } from './pulsex-smart-router';

const TOKEN_IN = '0x0000000000000000000000000000000000000001';
const TOKEN_OUT = '0x0000000000000000000000000000000000000002';
const RECIPIENT = '0x0000000000000000000000000000000000000003';
const quoteABI = new Interface([
  'function getPair(address,address) view returns (address)',
  'function getAmountsIn(uint256,address[]) view returns (uint256[])',
  'function getAmountsOut(uint256,address[]) view returns (uint256[])',
  'function allowance(address,address) view returns (uint256)',
]);
const swapABI = new Interface(PulseXSwapRouter);

// Exercise the real quote and calldata code with RPC reads and transaction sends
// intercepted. No wallet keys or network access are needed.
test('Amount Out selects the cheapest viable route and preserves its output minimum', async t => {
  const requested = 30n * 100_000_000n; // An eight-decimal output token.
  const quoted: bigint[] = [];
  t.mock.method(JsonRpcProvider.prototype, 'call', async (tx: { data: string }) => {
    const call = quoteABI.parseTransaction(tx)!;
    if (call.name === 'getPair') return quoteABI.encodeFunctionResult(call.name, [RECIPIENT]);
    if (call.name === 'allowance') return quoteABI.encodeFunctionResult(call.name, [MaxUint256]);
    assert.equal(call.name, 'getAmountsIn');
    quoted.push(call.args[0]);
    const path = call.args[1] as string[];
    // Direct route fails; WPLS requires less input than the other bridges.
    if (path.length === 2) throw new Error('Insufficient liquidity');
    const input = path[1].toLowerCase() === CONFIG.wpls.toLowerCase() ? 101n : 500n;
    return quoteABI.encodeFunctionResult(call.name, [[input, 50n, requested]]);
  });
  t.mock.method(ContractTransactionResponse.prototype, 'wait', async () => ({ hash: 'mock' }));
  const provider = new JsonRpcProvider();
  const sent: { data: string; value?: bigint }[] = [];
  const receipt = { hash: 'mock' };
  const wallet = {
    provider, address: RECIPIENT,
    getAddress: async () => RECIPIENT,
    call: (tx: any) => provider.call(tx),
    sendTransaction: async (tx: any) => {
      sent.push(tx);
      return { hash: 'mock', wait: async () => receipt };
    },
  } as unknown as Wallet;

  const best = await findBestPath(TOKEN_IN, TOKEN_OUT, requested, 'exactOut');
  assert.equal(best.amountIn, 101n);
  assert.equal(best.path[1].toLowerCase(), CONFIG.wpls.toLowerCase());
  for (const tokenIn of [TOKEN_IN, 'PLS']) {
    await executePulseXSmartSwap('test', tokenIn, TOKEN_OUT, requested, 0.01,
      RECIPIENT, async () => wallet, () => provider, 'exactOut');
    const tx = sent.at(-1)!;
    const call = swapABI.parseTransaction(tx)!;
    assert.equal(call.name, 'swapExactTokensForTokensV2');
    const expectedInput = tokenIn === 'PLS' ? 505n : 103n;
    assert.equal(call.args[0], expectedInput);
    assert.equal(call.args[1], requested);
    assert.equal(call.args[3].toLowerCase(), RECIPIENT.toLowerCase());
    assert.equal(tx.value ?? 0n, tokenIn === 'PLS' ? expectedInput : 0n);
  }
  assert.ok(quoted.length > 0);
  assert.ok(quoted.every(amount => amount === requested));
});

test('Amount In still selects maximum output and applies output slippage', async t => {
  t.mock.method(JsonRpcProvider.prototype, 'call', async (tx: { data: string }) => {
    const call = quoteABI.parseTransaction(tx)!;
    if (call.name === 'getPair') return quoteABI.encodeFunctionResult(call.name, [RECIPIENT]);
    if (call.name === 'allowance') return quoteABI.encodeFunctionResult(call.name, [MaxUint256]);
    assert.equal(call.name, 'getAmountsOut');
    assert.equal(call.args[0], 200n);
    const path = call.args[1] as string[];
    const amounts = path.length === 2 ? [200n, 1000n] : [200n, 50n, 500n];
    return quoteABI.encodeFunctionResult(call.name, [amounts]);
  });
  t.mock.method(ContractTransactionResponse.prototype, 'wait', async () => ({ hash: 'mock' }));
  const provider = new JsonRpcProvider();
  let sent: any;
  const wallet = {
    provider, address: RECIPIENT, getAddress: async () => RECIPIENT,
    call: (tx: any) => provider.call(tx),
    sendTransaction: async (tx: any) => {
      sent = tx;
      return { hash: 'mock', wait: async () => ({ hash: 'mock' }) };
    },
  } as unknown as Wallet;
  await executePulseXSmartSwap('test', TOKEN_IN, TOKEN_OUT, 200n, 0.01,
    RECIPIENT, async () => wallet, () => provider);
  const call = swapABI.parseTransaction(sent)!;
  assert.equal(call.args[0], 200n);
  assert.equal(call.args[1], 990n);
  assert.deepEqual(Array.from(call.args[2], address => String(address).toLowerCase()), [TOKEN_IN, TOKEN_OUT]);
});

test('invalid amounts and unquotable output fail before sending transactions', async t => {
  await assert.rejects(findBestPath(TOKEN_IN, TOKEN_OUT, 0n, 'exactOut'), /greater than zero/);
  await assert.rejects(findBestPath(TOKEN_IN, TOKEN_OUT, -1n, 'exactOut'), /greater than zero/);
  t.mock.method(JsonRpcProvider.prototype, 'call', async (tx: { data: string }) => {
    const call = quoteABI.parseTransaction(tx)!;
    if (call.name === 'getPair') return quoteABI.encodeFunctionResult(call.name, [RECIPIENT]);
    throw new Error('Insufficient liquidity');
  });
  await assert.rejects(findBestPath(TOKEN_IN, TOKEN_OUT, 100n, 'exactOut'), /could quote/);
});

// Isolate the production entry points from the database and wallet loader so
// these regressions cannot submit a trade or require a configured automation.
function loadFunctions(names: string[], dependencies: Record<string, unknown>) {
  const source = readFileSync(new URL('./blockchain-functions.ts', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('blockchain-functions.ts', source, ts.ScriptTarget.Latest, true);
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text ?? ''));
  assert.equal(functions.length, names.length);
  const code = functions.map(node => node.getText(ast).replace(/^export /, '')).join('\n');
  const context = vm.createContext(dependencies);
  vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context;
}

test('autoroute entry points read the selected amount, including legacy PLS nodes', async () => {
  let calls: any[][] = [];
  const fields: string[] = [];
  const context = loadFunctions(['executeNode'], {
    getWalletFromAutomation: async () => ({ address: RECIPIENT }),
    getProvider: () => ({}),
    resolveAmountField: async (field: string, data: Record<string, string>) => {
      fields.push(field);
      return BigInt(data[field] ?? 0);
    },
    executeAutoRouteSwap: async (...args: any[]) => { calls.push(args); return {}; },
    extractPiteasSwapOutput: async () => ({}),
    updateContextWithOutput: (context: unknown) => context,
  });
  for (const type of ['swap', 'swapFromPLS', 'swapPLS']) {
    for (const swapMode of ['exactIn', 'exactOut']) {
      for (const staleInput of [undefined, '123']) {
        calls = []; fields.length = 0;
        const inputField = type === 'swap' ? 'amountIn' : 'plsAmount';
        await context.executeNode('test', type, {
          autoRoute: true, swapMode, tokenIn: TOKEN_IN, tokenOut: TOKEN_OUT,
          amountOut: '999', [inputField]: swapMode === 'exactIn' ? '456' : staleInput,
        }, {});
        assert.deepEqual(fields, [swapMode === 'exactOut' ? 'amountOut' : inputField]);
        assert.equal(calls[0][3], swapMode === 'exactOut' ? 999n : 456n);
        assert.equal(calls[0][6], swapMode);
        assert.equal(calls[0][1], type === 'swap' ? TOKEN_IN : 'PLS');
      }
    }
  }
});

test('Amount Out failures cannot fall back to a swap that discards the output requirement', async () => {
  const failure = new Error('No route');
  let fallbacks = 0;
  const context = loadFunctions(['executeAutoRouteSwap'], {
    getWalletFromAutomation: () => {}, getProvider: () => {}, console: { warn: () => {} },
    executePulseXSmartSwap: async () => { throw failure; },
    executePiteasSwap: async () => { fallbacks++; return 'fallback'; },
  });
  await assert.rejects(context.executeAutoRouteSwap('test', TOKEN_IN, TOKEN_OUT, 100n, 0.01, RECIPIENT, 'exactOut'), failure);
  assert.equal(fallbacks, 0);
  assert.equal(await context.executeAutoRouteSwap('test', TOKEN_IN, TOKEN_OUT, 100n, 0.01, RECIPIENT), 'fallback');
  assert.equal(fallbacks, 1);
});
