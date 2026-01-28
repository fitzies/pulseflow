# How to Automate Dollar Cost Averaging (DCA) on PulseChain

Dollar Cost Averaging is one of the most popular investment strategies in crypto—and for good reason. By investing a fixed amount at regular intervals, you reduce the impact of volatility and remove emotion from your trading decisions. With PulseFlow, you can completely automate this strategy on PulseChain.

This guide will show you how to set up a simple DCA automation that runs every 24 hours, automatically swapping PLS into your chosen token and adding it to a liquidity pool.

## What You'll Build

By the end of this tutorial, you'll have an automation that:

1. Triggers automatically every 24 hours
2. Swaps a fixed amount of PLS into your target token
3. Automatically adds the purchased tokens to a liquidity pool

This creates a hands-off investment strategy that compounds your position over time.

## Step 1: Configure the Start Node

Every automation begins with the Start node. Click on the Start node to open its configuration panel.

### Setting Up Scheduled Triggers

In the config panel, you'll see the **Trigger Mode** option with three choices:

- **Manual:** Run on-demand when you click the Play button
- **Scheduled:** Run automatically on a set schedule
- **Price Trigger:** Execute when specific price conditions are met (Pro only)

For DCA automation, select **Scheduled** mode. This allows you to define exactly when your automation runs using a schedule expression.

### Configuring the Schedule

Set the schedule to run **every 24 hours**. This means your automation will execute once per day at midnight, automatically investing your set amount without any manual intervention.

**Pro Tip:** You can customize the schedule to match your DCA strategy—daily, weekly, monthly, or any custom interval that suits your investment goals.

Click **Save** to apply your trigger settings.

## Step 2: Add the Swap from PLS Node

Now we'll add the first action node: swapping PLS into your target token.

Click the **plus button** below the Start node and select **"Swap from PLS"** from the node menu.

### Configuring the Swap

Click on the newly added node to open its configuration panel:

1. **PLS Amount:** Enter the amount of PLS you want to invest each cycle. For this example, we'll use **1000 PLS**.

2. **Token Path:** Enter the contract address of the token you want to buy. In this example, we're using the **Mandala token**.

3. **Slippage:** Set your maximum acceptable slippage. We'll use **5%** to ensure the transaction goes through even during moderate price movements.

4. **Notes:** Add a descriptive note like "Daily DCA into Mandala" to help you remember this node's purpose at a glance.

Click **Save** to finalize your swap configuration.

## Step 3: Add Liquidity to Earn Yield

Simply holding tokens is one strategy, but you can take it further by automatically adding your purchased tokens to a liquidity pool to earn trading fees and yield.

Click the **plus button** below your Swap node and select **"Add Liquidity PLS"**.

### Configuring Liquidity Addition

This node pairs your newly purchased token with PLS and deposits both into a liquidity pool.

1. **Token:** This should already be set to Mandala from the previous step.

2. **Amount (Previous Output):** Instead of entering a fixed amount, select **"Previous Output"**. This tells the node to use the amount of Mandala you received from the previous swap.

3. **Percentage:** Set this to **95%**. This means you'll add 95% of your purchased Mandala to the liquidity pool, keeping 5% as a liquid position.

4. **PLS Amount:** Select **"Auto from LP Ratio"**. This automatically calculates the correct amount of PLS needed to pair with your Mandala based on the current pool ratio.

5. **Slippage:** Set to **5%** to match your swap slippage tolerance.

6. **Notes:** Add a note like "Auto-add to LP for yield" for clarity.

Click **Save**.

## Your Automation is Complete!

You've now created a fully automated DCA strategy that:

✅ Runs every day at midnight without manual intervention  
✅ Invests 1000 PLS into Mandala  
✅ Automatically adds 95% of purchased tokens to a liquidity pool  
✅ Compounds your position over time through LP rewards

## Before You Deploy

### Fund Your Automation Wallet

Remember to deposit enough PLS into your automation wallet to cover your DCA schedule. If you're investing 1000 PLS daily, make sure you have sufficient PLS for your desired timeframe plus gas fees.

You can find your automation wallet address in the left panel of the dashboard.

### Test Your Automation

Before enabling the schedule, consider running the automation manually once by clicking the **Play button** to ensure everything works as expected.

## Customization Ideas

Once you're comfortable with basic DCA, here are some ways to enhance your automation:

**Multi-Token DCA:** Create separate automations for different tokens to diversify your DCA strategy.

**Condition-Based Execution:** Add a Gas Guard node to only execute when gas prices are below your threshold, maximizing efficiency.

**Notifications:** Add a Telegram node at the end to receive confirmation notifications each time your DCA executes.

**Dynamic Amounts:** Use Condition nodes to adjust your investment amount based on your current portfolio balance.

**Weekly Instead of Daily:** Adjust your schedule to invest weekly or bi-weekly instead of daily for larger, less frequent purchases.

## The Power of Automation

The beauty of automating your DCA strategy is consistency. You'll never forget to invest, never let emotions influence your buying decisions, and never miss an opportunity due to being busy. Your automation runs 24/7, executing your strategy precisely as planned.

Whether you're accumulating for the long term or building LP positions for passive income, PulseFlow's DCA automation removes the friction from disciplined investing.

---

**Ready to set up your automated DCA strategy?** Head over to [PulseFlow](https://pulseflow.co) and start building smarter, more consistent investment workflows today.
