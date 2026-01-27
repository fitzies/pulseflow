# How to Automate PulseChain Using PulseFlow

Automating your trades on PulseChain has never been easier. With PulseFlow, you can create complex trading strategies without writing a single line of code. This guide will walk you through creating your first automation from start to finish.

## Getting Started

First, head to the top right corner and log in using your preferred provider—Google, or any of the other available options. You'll be prompted to select a subscription plan, but don't worry: both our Basic and Pro plans come with a free trial so you can explore PulseFlow risk-free.

## Creating Your First Automation

Once your plan is activated, click the **"Create Automation"** button on the right side of the screen and give your automation a name. After creation, select your automation to access its dedicated dashboard.

### Understanding Automation Settings

On the top left, you'll find the automation settings panel. Here you can:

- Change the automation name
- Set default slippage
- Modify the RPC endpoint
- Adjust visual helpers and enable beta features

The most important feature here is **"Reveal Private Key."** When you create a new automation, PulseFlow automatically generates a secure wallet and private key for you. This key is fully encrypted and accessible only by you.

**Pro Tip:** We highly recommend revealing your private key and importing it into your existing wallet (like MetaMask or Rabby) to ensure you never lose access to it.

The settings panel also includes options to reset your automation (clearing all nodes) or permanently delete it along with the associated wallet and private key.

## Building Your Automation

Every automation starts with a **Start node**—the entry point for your automation flow. You can drag it anywhere on the canvas and rotate around the workspace as needed.

### Adding Nodes

To add a new node, click the **plus button** below the Start node. This opens a panel displaying all available node types:

- Swap tokens
- Manage liquidity
- Check wallet balances
- Claim and burn on the playground
- Set up conditional "If" statements

### Example: Creating a Multi-Step Swap

Let's build a simple three-step automation:

**Step 1: Swap from PLS**

Select the "Swap from PLS" node and click on it to open the configuration panel. You'll choose between:

- **Amount In:** How much PLS you want to swap
- **Amount Out:** How much of the target token you want to receive

For this example, we'll select "Amount In" and enter 1000 PLS.

Next, configure the token path. Simply enter the token address—the last token in your path will be what you receive. We'll use the MDALA token address. PulseFlow automatically validates the token address and displays the token name for confirmation.

Finally, set your desired slippage and add a note in the Notes section to help you remember what this node does at a glance.

**Step 2: Standard Swap**

Add a "Swap" node. For the token path, the first token is what you're swapping from, and the last is what you're swapping into. Note that you cannot swap PLS in a standard Swap node—you must use the "Swap from PLS" or "Swap to PLS" nodes for PLS transactions.

We'll swap from MDALA to Maestro. Instead of entering a custom amount, select **"Previous Output"** and choose the previous node's output (amountOut). We'll swap 50% of the received MDALA.

In summary: we've swapped 1000 PLS into MDALA, then 50% of that MDALA into MAESTRO.

**Step 3: Swap to PLS**

Add a "Swap to PLS" node and select "Amount Out," which lets you specify the exact amount of PLS you want to receive. We'll enter 200 PLS and swap from MAESTRO.

## Executing Your Automation

Before running your automation, you'll need to deposit PLS into your automation wallet. Copy the wallet address from the left panel and send PLS from your MetaMask or other wallet.

When you're ready, click the **Play button** at the bottom to start the automation. You'll see purple loading indicators as each transaction processes on the blockchain. Once complete, nodes turn green, indicating successful execution.

When all nodes are green, your automation has completed successfully!

## What's Next?

This example demonstrates just a fraction of PulseFlow's capabilities. In reality, you can create much more complex automations with advanced logic, liquidity management, and conditional statements.

Stay tuned for our upcoming tutorial on scheduling automations to execute automatically at specific times throughout the day!

---

**Ready to automate your PulseChain strategy?** [Get started with PulseFlow](https://pulseflow.co) today and start building smarter, more efficient workflows.
