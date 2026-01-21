/**
 * Centralized node color configuration
 * All node colors use blue, indigo, violet, purple, or fuchsia with shades 400-600
 * 
 * Using literal class names so Tailwind CSS can detect them at build time
 */

export type NodeType =
  | 'start'
  | 'swap'
  | 'swapFromPLS'
  | 'swapToPLS'
  | 'transfer'
  | 'transferPLS'
  | 'addLiquidity'
  | 'addLiquidityPLS'
  | 'removeLiquidity'
  | 'removeLiquidityPLS'
  | 'checkBalance'
  | 'checkTokenBalance'
  | 'checkLPTokenAmounts'
  | 'checkPrice'
  | 'burnToken'
  | 'claimToken'
  | 'wait'
  | 'loop'
  | 'gasGuard'
  | 'condition'
  | 'telegram';

interface NodeColorClasses {
  background: string;
  text: string;
}

// Using literal class names so Tailwind can detect them
const nodeColors: Record<NodeType, NodeColorClasses> = {
  start: { background: 'bg-blue-500/20', text: 'text-blue-500' },
  swap: { background: 'bg-indigo-500/20', text: 'text-indigo-500' },
  swapFromPLS: { background: 'bg-indigo-400/20', text: 'text-indigo-400' },
  swapToPLS: { background: 'bg-indigo-400/20', text: 'text-indigo-400' },
  transfer: { background: 'bg-fuchsia-500/20', text: 'text-fuchsia-500' },
  transferPLS: { background: 'bg-fuchsia-400/20', text: 'text-fuchsia-400' },
  addLiquidity: { background: 'bg-blue-400/20', text: 'text-blue-400' },
  addLiquidityPLS: { background: 'bg-blue-500/20', text: 'text-blue-500' },
  removeLiquidity: { background: 'bg-purple-500/20', text: 'text-purple-500' },
  removeLiquidityPLS: { background: 'bg-purple-600/20', text: 'text-purple-600' },
  checkBalance: { background: 'bg-purple-400/20', text: 'text-purple-400' },
  checkTokenBalance: { background: 'bg-violet-600/20', text: 'text-violet-600' },
  checkLPTokenAmounts: { background: 'bg-indigo-400/20', text: 'text-indigo-400' },
  checkPrice: { background: 'bg-violet-400/20', text: 'text-violet-400' },
  burnToken: { background: 'bg-fuchsia-600/20', text: 'text-fuchsia-600' },
  claimToken: { background: 'bg-indigo-500/20', text: 'text-indigo-500' },
  wait: { background: 'bg-blue-500/20', text: 'text-blue-500' },
  loop: { background: 'bg-violet-400/20', text: 'text-violet-400' },
  gasGuard: { background: 'bg-purple-500/20', text: 'text-purple-500' },
  condition: { background: 'bg-amber-500/20', text: 'text-amber-500' },
  telegram: { background: 'bg-sky-500/20', text: 'text-sky-400' },
};

/**
 * Get the background color class for a node type
 */
export function getNodeBackgroundColor(nodeType: NodeType): string {
  return nodeColors[nodeType].background;
}

/**
 * Get the text/icon color class for a node type
 */
export function getNodeTextColor(nodeType: NodeType): string {
  return nodeColors[nodeType].text;
}

/**
 * Get both background and text color classes for a node type
 */
export function getNodeColors(nodeType: NodeType): {
  background: string;
  text: string;
} {
  return {
    background: getNodeBackgroundColor(nodeType),
    text: getNodeTextColor(nodeType),
  };
}
