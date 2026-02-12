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
  getParent: { background: 'bg-violet-500/20', text: 'text-violet-500' },
  wait: { background: 'bg-blue-500/20', text: 'text-blue-500' },
  loop: { background: 'bg-violet-400/20', text: 'text-violet-400' },
  gasGuard: { background: 'bg-purple-500/20', text: 'text-purple-500' },
  condition: { background: 'bg-amber-500/20', text: 'text-amber-500' },
  telegram: { background: 'bg-sky-500/20', text: 'text-sky-400' },
  variable: { background: 'bg-emerald-500/20', text: 'text-emerald-500' },
  calculator: { background: 'bg-cyan-500/20', text: 'text-cyan-500' },
  dexQuote: { background: 'bg-teal-500/20', text: 'text-teal-500' },
  forEach: { background: 'bg-orange-500/20', text: 'text-orange-500' },
  endForEach: { background: 'bg-orange-400/20', text: 'text-orange-400' },
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
