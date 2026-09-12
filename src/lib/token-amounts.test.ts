import assert from 'node:assert/strict';
import test from 'node:test';
import { Interface, parseUnits } from 'ethers';
import { getAmountToken } from './amount-token';
import { createExecutionContext, resolveAmountWithNodeData } from './execution-context';
import { getProvider } from './blockchain-functions';
import { CONFIG } from './config';

const HEX = '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39';
const EHEX = '0x57fde0a71132198BBeC939B98976993d8D89D225';
const TWO_PLS = '0x9852c09BA2Cd5e1cE2eA3e4c99ac1f2F51c34350';
const readDecimals = async (token: string) => token === HEX || token === EHEX ? 8 : 18;

async function amount(field: string, data: Record<string, any>, nodeType = 'swap') {
  return resolveAmountWithNodeData(data[field], data, createExecutionContext(), 'test', {
    token: getAmountToken(field, data, nodeType), readDecimals,
  });
}

test('both reported flows convert buy, liquidity and sell amounts to HEX raw units', async () => {
  for (const [token, buy, deposit, sell] of [[HEX, '30', '23', '5'], [EHEX, '100', '75', '15']]) {
    const staticAmount = (value: string) => ({ type: 'static', value });
    assert.equal(await amount('amountOut', {
      path: [TWO_PLS, token], swapMode: 'exactOut', amountOut: staticAmount(buy),
    }), BigInt(buy) * 100_000_000n);
    assert.equal(await amount('amountADesired', {
      tokenA: token, tokenB: TWO_PLS, amountADesired: staticAmount(deposit),
    }, 'addLiquidity'), BigInt(deposit) * 100_000_000n);
    assert.equal(await amount('amountIn', {
      path: [token, CONFIG.wpls], amountIn: staticAmount(sell),
    }, 'swapToPLS'), BigInt(sell) * 100_000_000n);
  }
});

test('input, output, auto-route, transfer and quote fields select the appropriate asset', async () => {
  const value = { type: 'static', value: '1.25' };
  for (const [field, data, type, decimals] of [
    ['amountIn', { path: [TWO_PLS, HEX] }, 'swap', 18],
    ['amountIn', { autoRoute: true, tokenIn: HEX }, 'swap', 8],
    ['amountIn', { autoRoute: true, usePLS: true }, 'swap', 18],
    ['amountOut', { path: [CONFIG.wpls, HEX] }, 'swapFromPLS', 8],
    ['amountOut', { autoRoute: true, tokenIn: TWO_PLS, tokenOut: HEX }, 'swap', 8],
    ['amountOut', { autoRoute: true, tokenOut: HEX }, 'swapFromPLS', 8],
    ['plsAmountOut', { path: [HEX, CONFIG.wpls] }, 'swapToPLS', 18],
    ['amount', { token: EHEX }, 'transfer', 8],
    ['amount', { path: [TWO_PLS, HEX], quoteMode: 'amountsIn' }, 'dexQuote', 8],
    ['amount', { path: [TWO_PLS, HEX], quoteMode: 'amountsOut' }, 'dexQuote', 18],
    ['amountTokenDesired', { token: HEX }, 'addLiquidityPLS', 8],
    ['amountBDesired', { tokenB: HEX }, 'addLiquidity', 8],
    ['plsAmount', {}, 'transferPLS', 18],
    ['liquidity', {}, 'removeLiquidity', 18],
  ] as const) {
    assert.equal(await amount(field, { ...data, [field]: value }, type), parseUnits('1.25', decimals));
  }
});

test('raw outputs, variables, legacy strings and missing amounts are not rescaled', async () => {
  const context = createExecutionContext();
  context.previousNodeId = 'balance';
  context.nodeOutputs.set('balance', { balance: 3_000_000_000n });
  context.variables.set('hex', 3_000_000_000n);
  const options = { token: HEX, readDecimals: async (): Promise<number> => { throw new Error('Unexpected decimals lookup'); } };
  for (const [config, expected] of [
    [{ type: 'previousOutput', field: 'balance', percentage: 25 }, 750_000_000n],
    [{ type: 'variable', variableName: 'hex' }, 3_000_000_000n],
    ['3000000000', 3_000_000_000n],
    [undefined, 0n],
  ] as const) {
    assert.equal(await resolveAmountWithNodeData(config, {}, context, 'test', options), expected);
  }
});

test('invalid precision and failed token metadata stop conversion', async () => {
  await assert.rejects(amount('amount', { token: HEX, amount: { type: 'static', value: '0.000000001' } }, 'transfer'));
  await assert.rejects(amount('amount', { token: HEX, amount: { type: 'static', value: '-1' } }, 'transfer'), /negative/);
  await assert.rejects(resolveAmountWithNodeData({ type: 'static', value: '30' }, {}, createExecutionContext(), 'test', {
    token: HEX, readDecimals: async () => { throw new Error('metadata unavailable'); },
  }), /metadata unavailable/);
  assert.throws(() => getAmountToken('amountOut', { path: [] }, 'swap'), /Cannot determine token/);
});

test('the production metadata reader calls decimals and stops on RPC failure', async (t) => {
  const abi = new Interface(['function decimals() view returns(uint8)']);
  const rpc = t.mock.method(getProvider(), 'call', async (tx: { data: string }) => {
    assert.equal(abi.parseTransaction(tx)!.name, 'decimals');
    return abi.encodeFunctionResult('decimals', [8]);
  });
  const config = { type: 'static' as const, value: '30' };
  assert.equal(await resolveAmountWithNodeData(config, {}, createExecutionContext(), 'test', { token: HEX }), 3_000_000_000n);
  rpc.mock.mockImplementation(async () => { throw new Error('RPC unavailable'); });
  await assert.rejects(resolveAmountWithNodeData(config, {}, createExecutionContext(), 'test', { token: HEX }), /Cannot read decimals/);
});

test('LP ratios scale the base token once and return raw paired units, including PLS in either direction', async (t) => {
  const abi = new Interface([
    'function factory() view returns(address)',
    'function getPair(address,address) view returns(address)',
    'function getReserves() view returns(uint112,uint112,uint32)',
    'function token0() view returns(address)',
    'function quote(uint256,uint256,uint256) view returns(uint256)',
  ]);
  t.mock.method(getProvider(), 'call', async (tx: { data: string }) => {
    const call = abi.parseTransaction(tx)!;
    const values = call.name === 'factory' || call.name === 'getPair' ? [TWO_PLS]
      : call.name === 'token0' ? [HEX]
      : call.name === 'getReserves' ? [100_000_000_000n, parseUnits('2000', 18), 0]
      : [call.args[0] * call.args[2] / call.args[1]];
    return abi.encodeFunctionResult(call.name, values);
  });
  const context = createExecutionContext();
  const ratio = { type: 'lpRatio' as const, baseTokenField: 'tokenA', baseAmountField: 'amountADesired', pairedTokenField: 'tokenB' };
  const data = { tokenA: HEX, tokenB: TWO_PLS, amountADesired: { type: 'static', value: '23' } };
  assert.equal(await resolveAmountWithNodeData(ratio, data, context, 'test', { readDecimals }), parseUnits('46', 18));
  for (const backwards of [false, true]) {
    const field = backwards ? 'plsAmount' : 'amountTokenDesired';
    const config = { type: 'lpRatio' as const, baseTokenField: 'token', baseAmountField: field, pairedToken: 'PLS' };
    assert.equal(await resolveAmountWithNodeData(config, { token: HEX, [field]: { type: 'static', value: '10' } }, context, 'test', { readDecimals }),
      backwards ? 500_000_000n : parseUnits('20', 18));
  }
});
