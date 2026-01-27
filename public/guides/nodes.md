# Complete Guide to PulseFlow Node Types

PulseFlow offers a comprehensive suite of nodes that allow you to build sophisticated automation workflows on PulseChain. This guide covers all 20 node types and their configuration options to help you maximize your automation potential.

## Getting Started with Nodes

Every automation in PulseFlow is built using nodes—individual components that perform specific actions. You can chain these nodes together to create complex trading strategies, liquidity management systems, and conditional workflows.

To add a node, simply click the plus button below any existing node to open the node selection panel.

---

## Core Trading Nodes

### 1. Swap Node

The standard swap node allows you to exchange one token for another using PulseChain's DEX infrastructure.

**Configuration:**

- **Swap Mode:** Choose between "Exact In" (specify input amount) or "Exact Out" (specify output amount)
- **Amount In/Out:** The token amount you're swapping or receiving
- **Token Path:** Array of token addresses defining your swap route (first token = from, last token = to)
- **Slippage:** Maximum acceptable slippage percentage (default: 1%)
- **Notes:** Personal notes to describe this node's purpose (displayed below the node)

**Important:** You cannot swap PLS directly in this node. Use the specialized PLS swap nodes below.

### 2. Swap From PLS Node

Specifically designed for swapping PLS into other tokens.

**Configuration:**

- **Swap Mode:** "Exact In" or "Exact Out"
- **PLS Amount:** Amount of PLS to swap (if using Exact In)
- **Amount Out:** Desired token output (if using Exact Out)
- **Token Path:** Token addresses (WPLS is automatically prepended)
- **Slippage:** Maximum acceptable slippage
- **Notes:** Custom description

**Why use this?** PulseFlow automatically handles the PLS to WPLS conversion, simplifying your workflow.

### 3. Swap To PLS Node

Designed for swapping tokens back into PLS.

**Configuration:**

- **Swap Mode:** "Exact In" or "Exact Out"
- **Amount In:** Token amount to swap (if using Exact In)
- **PLS Amount Out:** Desired PLS output (if using Exact Out)
- **Token Path:** Token addresses (WPLS is automatically appended)
- **Slippage:** Maximum acceptable slippage
- **Notes:** Custom description

---

## Liquidity Management Nodes

### 4. Add Liquidity Node

Add liquidity to a token pair on PulseChain DEXs.

**Configuration:**

- **Token A:** First token contract address
- **Token B:** Second token contract address
- **Amount A Desired:** Desired amount of Token A
- **Amount B Desired:** Desired amount of Token B
- **Slippage:** Acceptable deviation from desired amounts
- **Notes:** Custom description

**Use Case:** Building LP positions, yield farming strategies, or rebalancing liquidity allocations.

### 5. Add Liquidity PLS Node

Simplified node for adding liquidity to PLS pairs.

**Configuration:**

- **Token:** The token to pair with PLS
- **Amount Token Desired:** Desired token amount
- **PLS Amount:** Amount of PLS to add
- **Slippage:** Maximum acceptable slippage
- **Notes:** Custom description

### 6. Remove Liquidity Node

Remove liquidity from a token pair position.

**Configuration:**

- **Token A:** First token address
- **Token B:** Second token address
- **Liquidity:** Amount of LP tokens to burn
- **Slippage:** Maximum acceptable slippage
- **Notes:** Custom description

### 7. Remove Liquidity PLS Node

Remove liquidity from PLS pair positions.

**Configuration:**

- **Token:** The token paired with PLS
- **Liquidity:** LP token amount to burn
- **Slippage:** Maximum acceptable slippage
- **Notes:** Custom description

---

## Transfer Nodes

### 8. Transfer Node

Send ERC20 tokens to another address.

**Configuration:**

- **Token:** Token contract address
- **To:** Recipient wallet address
- **Amount:** Token amount to transfer
- **Notes:** Custom description

**Use Case:** Moving funds between wallets, distributing tokens, or setting up payment workflows.

### 9. Transfer PLS Node

Send PLS to another address.

**Configuration:**

- **To:** Recipient wallet address
- **PLS Amount:** Amount of PLS to send
- **Notes:** Custom description

---

## Playground Token Nodes (Arbitrage Opportunities)

### 10. Burn Token Node

Burn playground tokens on-chain with 1:1 conversion.

**Configuration:**

- **Token:** Playground token address only
- **Amount:** Token amount to burn
- **Notes:** Custom description

**Note:** This node only works with playground tokens—a special token type on PulseChain.

### 11. Claim Token Node

Claim playground tokens on-chain with 1:1 conversion.

**Configuration:**

- **Token:** Playground token address only
- **Amount:** Token amount to claim
- **Notes:** Custom description

**Use Case:** Playground tokens allow you to burn and claim tokens at a 1:1 ratio on-chain, creating arbitrage opportunities. When the market price deviates from this 1:1 peg, you can profit by buying tokens below peg and claiming, or burning tokens and selling above peg. These nodes enable automated arbitrage strategies for playground tokens.

---

## Information & Analysis Nodes

### 12. Check LP Token Amounts Node

Analyze your liquidity pool positions.

**Configuration:**

- **Pair Address:** LP pair contract address
- **Notes:** Custom description

**Outputs:**

- Ratio between tokens
- LP balance
- Token 0 amount
- Token 1 amount

**Use Case:** Monitor LP positions before removing liquidity or making rebalancing decisions.

### 13. Check Token Balance Node

Check your balance of any ERC20 token.

**Configuration:**

- **Token:** ERC20 contract address
- **Notes:** Custom description

**Use Case:** Use the output in conditional nodes to create balance-based triggers.

### 14. Check Balance Node

Quick check of your automation wallet's overall balance.

**Configuration:**

- **Notes:** Custom description only (no other configuration needed)

---

## Flow Control Nodes

### 15. Start Node

Every automation begins here. This is your automation's entry point and trigger configuration.

**Configuration:**

- **Trigger Mode:**
  - **Manual:** Execute on-demand via the Play button
  - **Schedule:** Run automatically on a cron schedule (Pro only)
  - **Price Trigger:** Execute when price conditions are met (Pro only)

**For Schedule Mode:**

- **Cron Expression:** Define your execution schedule using cron syntax

**For Price Trigger Mode (Pro):**

- **Price LP Address:** The LP pair to monitor
- **Price Operator:** < , > , <= , or >=
- **Price Value:** USD price threshold
- **Price Cooldown Minutes:** Wait time between triggers (1-1440 minutes)

**Notes:** Limited to 50 characters

### 16. Wait Node

Pause execution for a specified duration.

**Configuration:**

- **Delay:** Wait time in seconds (1-10 seconds)
- **Notes:** Custom description

**Use Case:** Space out transactions, wait for confirmations, or implement rate limiting.

### 17. Loop Node

Repeat a section of your automation multiple times.

**Configuration:**

- **Loop Count:** Number of iterations (1-3)
- **Notes:** Custom description

**Use Case:** Execute multiple small swaps, compound strategies, or batch operations.

### 18. Gas Guard Node

Protect your automation from executing during high gas price periods.

**Configuration:**

- **Max Gas Price:** Maximum acceptable gas price in beats/wei
- **Notes:** Custom description

**Feature:** Displays current network gas price for reference.

**Use Case:** Ensure your automation only executes when gas is economical.

---

## Conditional Logic Nodes

### 19. Condition Node

Create "if-then" logic in your automations.

**Configuration:**

- **Condition Type:** What to evaluate
  - **PLS Balance:** Check your PLS balance
  - **Token Balance:** Check specific token balance
  - **LP Amount:** Check LP position size
  - **Previous Output:** Use output from previous node

- **Operator:** Comparison operator ( > , < , >= , <= , == )
- **Value:** The threshold value to compare against
- **Token Address:** Required if checking token balance
- **LP Pair Address:** Required if checking LP amount
- **Previous Output Field:** Required if using previous output

**Notes:** Custom description

**Use Case:** Create intelligent automations that adapt based on your portfolio state, market conditions, or previous transaction results.

---

## Notification Nodes

### 20. Telegram Node

Send notifications to your Telegram account.

**Configuration:**

- **Message:** Template text with dynamic variables
- **Notes:** Custom description

**Available Variables:**

- `{{automation.name}}` - Your automation's name
- `{{timestamp}}` - Current timestamp
- `{{previousNode.output}}` - Data from previous node
- And more!

**Use Case:** Get real-time notifications when automations execute, monitor performance, or receive alerts on specific conditions.

---

## Building Complex Automations

The real power of PulseFlow comes from chaining these nodes together. Here are some examples of what you can build:

**Example 1: Automated Yield Farming**

1. Start Node (scheduled trigger)
2. Check Token Balance Node
3. Condition Node (if balance > threshold)
4. Swap Node (compound rewards)
5. Add Liquidity Node
6. Telegram Node (success notification)

**Example 2: Price-Based Trading**

1. Start Node (price trigger)
2. Gas Guard Node
3. Swap From PLS Node
4. Wait Node
5. Check Token Balance Node
6. Telegram Node (execution summary)

**Example 3: Smart Liquidity Rebalancing**

1. Start Node (scheduled)
2. Check LP Token Amounts Node
3. Condition Node (check ratio)
4. Remove Liquidity Node
5. Swap Node (rebalance)
6. Add Liquidity Node

---

## Tips for Success

**Use Notes Liberally:** The notes field on each node helps you understand your automation at a glance. Future-you will thank present-you.

**Monitor Gas Prices:** Use Gas Guard nodes to ensure your automations execute cost-effectively.

**Start Simple:** Begin with basic 2-3 node automations and gradually increase complexity as you become comfortable.

**Leverage Conditions:** Conditional nodes make your automations intelligent and adaptive rather than blindly executing the same steps.

**Set Appropriate Slippage:** Too low and transactions may fail; too high and you may get poor execution. Start with 1-2% and adjust based on token liquidity.

---

## Pro Features

Certain advanced features are available exclusively on Pro plans:

- **Scheduled Automations:** Run automations automatically on a schedule
- **Price Triggers:** Execute based on real-time price movements
- **Advanced Condition Types:** More sophisticated conditional logic

Ready to build your first automation? Head over to [PulseFlow](https://pulseflow.co) and start creating smarter, more efficient workflows today!
