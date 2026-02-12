# How to Use the For Each Node

The For Each node lets you iterate over a list of token or LP pair addresses and run the same sequence of nodes once for each item. Instead of creating separate flows for each token or LP, you define one list and one body—the automation runs the body for every address in the list. This guide explains exactly how to configure the For Each node, how to select tokens and LPs in the list, and how to use "Use For-Each Item" in body nodes to operate on each address.

**Note:** The For Each node is available on Pro and Ultra plans only.

## What the For Each Node Does

When you add a For Each node, PulseFlow automatically creates two nodes: **For Each** and **End For Each**. Nodes placed between them form the "body" of the loop. At runtime, the automation executes the body once for each address in the list, with that address available as the current item.

For example, if your list contains [MDALA, DOME, ENSU], a Swap node inside the body that uses "Use For-Each Item" will swap MDALA on the first run, DOME on the second, and ENSU on the third.

## Configuring the For Each Node

Click the For Each node to open its configuration panel.

### Item Type

Choose **Tokens** or **LP Pairs** from the dropdown. This determines:

- What type of addresses you add to the list
- What the selection picker expects when you add items

If you select "Tokens," each item must be an ERC20 token contract address. If you select "LP Pairs," each item must be an LP pair contract address (e.g., from PulseX).

### Adding Addresses

Use the **Add Token** or **Add LP Pair** button to add items to the list. You can add up to 10 items.

For each address slot:

1. Click the field to open the selection dialog
2. When Item Type is **Tokens**, the dialog shows "Select Token" and validates ERC20 addresses
3. When Item Type is **LP Pairs**, the dialog shows "Select LP Pair" and validates LP pair addresses

### Selecting Tokens or LPs

The token/LP picker offers several ways to choose an address:

- **Search by name or paste address** — Type a token name or paste a full 0x address. If you paste a valid address, the system looks it up on-chain and displays the name/symbol
- **Recent** — Previously used tokens or LPs are stored separately for tokens vs LPs
- **Suggested** — Common tokens such as Mandala (MDALA), Matrix Oracle (MXORA), ZeroTrust (ZERØ), Domeshot (DOME), and Ensu (ENSU) appear when selecting tokens

### Timeout Warning

If you add 5 or more items, a warning appears: the automation may hit the 10-minute maximum runtime. Consider keeping lists under 5 items when possible.

## What Happens at Runtime

For each address in the list, the runner:

1. Sets the current item to that address
2. Executes all body nodes (between For Each and End For Each)
3. Moves to the next item and repeats until the list is done

**Limitation:** Nested For Each blocks are not supported. You cannot put a For Each node inside another For Each block.

## Using "Use For-Each Item" in Body Nodes

To make a body node operate on the current loop item instead of a fixed address, use "Use For-Each Item."

### Where It Appears

"Use For-Each Item" is only available in nodes that are **inside** a For Each block—between the For Each node and the End For Each node. Nodes outside the block do not show this option.

### How to Select It

1. Click the token, LP, or address field you want to make dynamic
2. The selection dialog opens
3. At the top, under **For-Each**, choose **Use For-Each Item**
4. The field will display "For-Each Item" in orange instead of a specific address

### What It Does

At runtime, any field set to "Use For-Each Item" is replaced with the current address from the loop. So if your list is [TokenA, TokenB, TokenC]:

- First iteration: the field uses TokenA
- Second iteration: the field uses TokenB
- Third iteration: the field uses TokenC

### Supported Nodes and Fields

You can use "Use For-Each Item" in these nodes and fields:

| Node | Fields |
|------|--------|
| Swap | Token path (any position) |
| Transfer | Token, To address |
| Transfer PLS | To address |
| Add Liquidity | Token A, Token B |
| Add Liquidity PLS | Token |
| Remove Liquidity | Token A, Token B |
| Remove Liquidity PLS | Token |
| Burn Token | Token |
| Claim Token | Token |
| Check LP Token Amounts | Pair address |
| Check Token Balance | Token |
| Condition | Token address, LP pair address (when applicable) |

## Example Use Cases

### Multi-Token DCA

Iterate over several tokens and swap PLS into each, then add liquidity:

1. Add a For Each node with Item Type "Tokens" and addresses: MDALA, DOME, ENSU
2. Inside the body: Swap from PLS node — set the token path to **Use For-Each Item**
3. Add Liquidity PLS node — set Token to **Use For-Each Item**, configure amount as needed
4. Save and run

Each execution will swap PLS into the first token, add liquidity, then repeat for the next token, and so on.

### Batch LP Removal

Remove liquidity from multiple LP positions:

1. Add a For Each node with Item Type "LP Pairs" and add your LP pair addresses
2. Inside the body: Remove Liquidity PLS node — set Token to **Use For-Each Item**, configure liquidity amount
3. Save and run

The automation will remove liquidity from each LP pair in the list.

### Check Balances Across Tokens

Check your balance for each token in a list:

1. Add a For Each node with Item Type "Tokens" and your token addresses
2. Inside the body: Check Token Balance node — set Token to **Use For-Each Item**
3. Optionally add a Telegram node to report results

## Summary and Tips

- **Match Item Type to your list** — Use "Tokens" for token addresses and "LP Pairs" for LP pair addresses
- **Click the field to open the picker** — Token and LP fields use a click-to-open dialog for selection
- **Bodies must be between For Each and End For Each** — Only nodes in that range see "Use For-Each Item"
- **Keep lists under 5 items when possible** — To reduce the risk of hitting the 10-minute timeout
- **No nested loops** — You cannot place a For Each block inside another For Each block

---

**Ready to automate multi-token or multi-LP workflows?** Head over to [PulseFlow](https://pulseflow.co) and start building with the For Each node.
