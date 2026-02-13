/**
 * Centralized node color and layout configuration
 * All node colors use blue, indigo, violet, purple, or fuchsia with shades 400-600
 * 
 * Using literal class names so Tailwind CSS can detect them at build time
 */

// ============================================
// NODE LAYOUT CONFIGURATION
// ============================================

/** Classes for the outer wrapper div (flex container) */
export const NODE_WRAPPER_CLASS = 'flex flex-col items-center';

/** Width class for the BaseNode card (icon container) */
export const NODE_WIDTH_CLASS = 'w-24 flex flex-col items-center justify-center';
export const NODE_HEIGHT_CLASS = 'h-24';

/** Width class for condition node (slightly wider for True/False labels) */
export const NODE_WIDTH_CONDITION_CLASS = 'w-28';
export const NODE_HEIGHT_CONDITION_CLASS = 'h-28';

/** Classes for the label container below the node */
export const NODE_LABEL_CONTAINER_CLASS = 'mt-2 text-center max-w-40';

/** Classes for wider labels (longer text like "Remove Liquidity PLS") */
export const NODE_LABEL_CONTAINER_WIDE_CLASS = 'mt-2 text-center max-w-40';

/** Classes for the title text */
export const NODE_TITLE_CLASS = 'text-sm font-medium';

/** Classes for the notes text */
export const NODE_NOTES_CLASS = 'text-xs text-muted-foreground break-all';

// ============================================
// NODE TYPES
// ============================================

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
  | 'getParent'
  | 'wait'
  | 'loop'
  | 'gasGuard'
  | 'condition'
  | 'telegram'
  | 'variable'
  | 'calculator'
  | 'dexQuote'
  | 'forEach'
  | 'endForEach';

interface NodeColorClasses {
  background: string;
  text: string;
}

// Using literal class names so Tailwind can detect them
const nodeColors: Record<string, { background: string; text: string }> = {
  start: { background: 'bg-amber-600/20', text: 'text-amber-500' },
  swap: { background: 'bg-yellow-700/20', text: 'text-yellow-600' },
  swapFromPLS: { background: 'bg-orange-600/20', text: 'text-orange-500' },
  swapToPLS: { background: 'bg-amber-700/20', text: 'text-amber-600' },
  transfer: { background: 'bg-yellow-600/20', text: 'text-yellow-500' },
  transferPLS: { background: 'bg-orange-700/20', text: 'text-orange-600' },
  addLiquidity: { background: 'bg-amber-500/20', text: 'text-amber-400' },
  addLiquidityPLS: { background: 'bg-yellow-800/20', text: 'text-yellow-700' },
  removeLiquidity: { background: 'bg-orange-500/20', text: 'text-orange-400' },
  removeLiquidityPLS: { background: 'bg-amber-800/20', text: 'text-amber-700' },
  checkBalance: { background: 'bg-rose-500/20', text: 'text-rose-400' },
  checkTokenBalance: { background: 'bg-pink-600/20', text: 'text-pink-500' },
  checkLPTokenAmounts: { background: 'bg-rose-600/20', text: 'text-rose-500' },
  checkPrice: { background: 'bg-pink-700/20', text: 'text-pink-600' },
  burnToken: { background: 'bg-rose-700/20', text: 'text-rose-600' },
  claimToken: { background: 'bg-pink-800/20', text: 'text-pink-700' },
  getParent: { background: 'bg-rose-800/20', text: 'text-rose-700' },
  wait: { background: 'bg-pink-500/20', text: 'text-pink-400' },
  loop: { background: 'bg-red-500/20', text: 'text-red-400' },
  gasGuard: { background: 'bg-red-600/20', text: 'text-red-500' },
  condition: { background: 'bg-red-700/20', text: 'text-red-600' },
  telegram: { background: 'bg-red-800/20', text: 'text-red-700' },
  variable: { background: 'bg-rose-500/20', text: 'text-rose-400' },
  calculator: { background: 'bg-pink-600/20', text: 'text-pink-500' },
  dexQuote: { background: 'bg-amber-600/20', text: 'text-amber-500' },
  forEach: { background: 'bg-yellow-500/20', text: 'text-yellow-400' },
  endForEach: { background: 'bg-orange-600/20', text: 'text-orange-500' },
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
