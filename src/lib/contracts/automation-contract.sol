// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);
}

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint[] memory amounts);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint[] memory amounts);

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint[] memory amounts);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    )
        external
        payable
        returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);

    function removeLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountToken, uint256 amountETH);

    function WPLS() external pure returns (address);
    function factory() external pure returns (address);
}

interface IUniswapV2Factory {
    function getPair(
        address tokenA,
        address tokenB
    ) external view returns (address pair);
}

interface IUniswapV2Pair {
    function getReserves()
        external
        view
        returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function totalSupply() external view returns (uint256);
}

interface IPlaygroundToken {
    function parent() external view returns (address);
    function burn(uint256 amount) external; // Wraps parent tokens into PlaygroundTokens
    function claim(uint256 amount) external; // Unwraps PlaygroundTokens back to parent tokens
}

contract AutomationContract {
    address public immutable pulseXRouter;
    address public constant WPLS = 0xA1077a294dDE1B09bB078844df40758a5D0f9a27;

    constructor(address _pulseXRouter) {
        require(_pulseXRouter != address(0), "Invalid router address");
        pulseXRouter = _pulseXRouter;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint[] memory amounts) {
        require(path.length >= 2, "Invalid path");
        require(to != address(0), "Invalid recipient");
        require(deadline >= block.timestamp, "Expired deadline");

        IERC20 tokenIn = IERC20(path[0]);
        require(
            tokenIn.transferFrom(msg.sender, address(this), amountIn),
            "Transfer failed"
        );
        require(tokenIn.approve(pulseXRouter, amountIn), "Approval failed");

        amounts = IUniswapV2Router02(pulseXRouter).swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            to,
            deadline
        );
    }

    function swapExactPLSForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint[] memory amounts) {
        require(path.length >= 2, "Invalid path");
        require(path[0] == WPLS, "Path must start with WPLS");
        require(to != address(0), "Invalid recipient");
        require(deadline >= block.timestamp, "Expired deadline");

        uint256 plsAmount = msg.value;

        amounts = IUniswapV2Router02(pulseXRouter).swapExactETHForTokens{
            value: plsAmount
        }(amountOutMin, path, to, deadline);
    }

    function swapExactTokensForPLS(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint[] memory amounts) {
        require(path.length >= 2, "Invalid path");
        require(path[path.length - 1] == WPLS, "Path must end with WPLS");
        require(to != address(0), "Invalid recipient");
        require(deadline >= block.timestamp, "Expired deadline");

        IERC20 tokenIn = IERC20(path[0]);
        require(
            tokenIn.transferFrom(msg.sender, address(this), amountIn),
            "Transfer failed"
        );
        require(tokenIn.approve(pulseXRouter, amountIn), "Approval failed");

        amounts = IUniswapV2Router02(pulseXRouter).swapExactTokensForETH(
            amountIn,
            amountOutMin,
            path,
            to,
            deadline
        );
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        payable
        returns (uint256 amountA, uint256 amountB, uint256 liquidity)
    {
        require(
            tokenA != address(0) && tokenB != address(0),
            "Invalid token addresses"
        );
        require(to != address(0), "Invalid recipient");
        require(deadline >= block.timestamp, "Expired deadline");

        IERC20 tokenA_contract = IERC20(tokenA);
        IERC20 tokenB_contract = IERC20(tokenB);

        require(
            tokenA_contract.transferFrom(
                msg.sender,
                address(this),
                amountADesired
            ),
            "TokenA transfer failed"
        );
        require(
            tokenB_contract.transferFrom(
                msg.sender,
                address(this),
                amountBDesired
            ),
            "TokenB transfer failed"
        );

        require(
            tokenA_contract.approve(pulseXRouter, amountADesired),
            "TokenA approval failed"
        );
        require(
            tokenB_contract.approve(pulseXRouter, amountBDesired),
            "TokenB approval failed"
        );

        (amountA, amountB, liquidity) = IUniswapV2Router02(pulseXRouter)
            .addLiquidity(
                tokenA,
                tokenB,
                amountADesired,
                amountBDesired,
                amountAMin,
                amountBMin,
                to,
                deadline
            );

        // Refund excess tokens
        if (amountADesired > amountA) {
            tokenA_contract.transfer(msg.sender, amountADesired - amountA);
        }
        if (amountBDesired > amountB) {
            tokenB_contract.transfer(msg.sender, amountBDesired - amountB);
        }
    }

    function addLiquidityPLS(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountPLSMin,
        address to,
        uint256 deadline
    )
        external
        payable
        returns (uint256 amountToken, uint256 amountPLS, uint256 liquidity)
    {
        require(token != address(0), "Invalid token address");
        require(to != address(0), "Invalid recipient");
        require(deadline >= block.timestamp, "Expired deadline");

        uint256 plsAmount = msg.value;

        IERC20 tokenContract = IERC20(token);
        require(
            tokenContract.transferFrom(
                msg.sender,
                address(this),
                amountTokenDesired
            ),
            "Token transfer failed"
        );
        require(
            tokenContract.approve(pulseXRouter, amountTokenDesired),
            "Token approval failed"
        );

        (amountToken, amountPLS, liquidity) = IUniswapV2Router02(pulseXRouter)
            .addLiquidityETH{value: plsAmount}(
            token,
            amountTokenDesired,
            amountTokenMin,
            amountPLSMin,
            to,
            deadline
        );

        // Refund excess token
        if (amountTokenDesired > amountToken) {
            tokenContract.transfer(
                msg.sender,
                amountTokenDesired - amountToken
            );
        }
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountA, uint256 amountB) {
        require(
            tokenA != address(0) && tokenB != address(0),
            "Invalid token addresses"
        );
        require(to != address(0), "Invalid recipient");
        require(deadline >= block.timestamp, "Expired deadline");

        // Get pair address from factory
        address factoryAddress = IUniswapV2Router02(pulseXRouter).factory();
        address pair = IUniswapV2Factory(factoryAddress).getPair(
            tokenA,
            tokenB
        );
        require(pair != address(0), "Pair does not exist");

        IERC20(pair).transferFrom(msg.sender, address(this), liquidity);
        IERC20(pair).approve(pulseXRouter, liquidity);

        (amountA, amountB) = IUniswapV2Router02(pulseXRouter).removeLiquidity(
            tokenA,
            tokenB,
            liquidity,
            amountAMin,
            amountBMin,
            to,
            deadline
        );
    }

    function removeLiquidityPLS(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountPLSMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountPLS) {
        require(token != address(0), "Invalid token address");
        require(to != address(0), "Invalid recipient");
        require(deadline >= block.timestamp, "Expired deadline");

        // Get pair address from factory
        address factoryAddress = IUniswapV2Router02(pulseXRouter).factory();
        address pair = IUniswapV2Factory(factoryAddress).getPair(token, WPLS);
        require(pair != address(0), "Pair does not exist");

        IERC20(pair).transferFrom(msg.sender, address(this), liquidity);
        IERC20(pair).approve(pulseXRouter, liquidity);

        (amountToken, amountPLS) = IUniswapV2Router02(pulseXRouter)
            .removeLiquidityETH(
                token,
                liquidity,
                amountTokenMin,
                amountPLSMin,
                to,
                deadline
            );
    }

    function transferToken(
        address token,
        address to,
        uint256 amount
    ) external payable {
        require(token != address(0), "Invalid token address");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");

        IERC20 tokenContract = IERC20(token);
        require(
            tokenContract.transferFrom(msg.sender, to, amount),
            "Transfer failed"
        );
    }

    function burnToken(address token, uint256 amount) external payable {
        require(isPlaygroundToken(token), "Not a playground token");
        require(amount > 0, "Invalid amount");

        IPlaygroundToken playgroundToken = IPlaygroundToken(token);
        address parentToken = playgroundToken.parent();
        IERC20 parentContract = IERC20(parentToken);
        IERC20 tokenContract = IERC20(token);

        // Transfer parent tokens from user to this contract
        require(
            parentContract.transferFrom(msg.sender, address(this), amount),
            "Parent token transfer failed"
        );

        // Approve playground token to take parent tokens
        require(
            parentContract.approve(token, amount),
            "Parent token approval failed"
        );

        // Call burn() which wraps parent tokens into PlaygroundTokens (mints to this contract)
        playgroundToken.burn(amount);

        // Transfer minted PlaygroundTokens to user
        uint256 balance = tokenContract.balanceOf(address(this));
        if (balance > 0) {
            tokenContract.transfer(msg.sender, balance);
        }
    }

    function claimToken(address token, uint256 amount) external payable {
        require(isPlaygroundToken(token), "Not a playground token");
        require(amount > 0, "Invalid amount");

        IPlaygroundToken playgroundToken = IPlaygroundToken(token);
        IERC20 tokenContract = IERC20(token);

        // Transfer PlaygroundTokens from user to this contract
        require(
            tokenContract.transferFrom(msg.sender, address(this), amount),
            "PlaygroundToken transfer failed"
        );

        // Call claim() which burns PlaygroundTokens and transfers parent tokens to this contract
        playgroundToken.claim(amount);

        // Transfer parent tokens to user
        address parentToken = playgroundToken.parent();
        IERC20 parentContract = IERC20(parentToken);
        uint256 parentBalance = parentContract.balanceOf(address(this));
        if (parentBalance > 0) {
            parentContract.transfer(msg.sender, parentBalance);
        }
    }

    function checkLPTokenAmounts(
        address pairAddress,
        address user
    )
        external
        view
        returns (
            uint256 lpBalance,
            address token0,
            address token1,
            uint256 token0Amount,
            uint256 token1Amount
        )
    {
        require(pairAddress != address(0), "Invalid pair address");
        require(user != address(0), "Invalid user address");

        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        IERC20 lpToken = IERC20(pairAddress);

        lpBalance = lpToken.balanceOf(user);
        token0 = pair.token0();
        token1 = pair.token1();

        if (lpBalance > 0) {
            (uint112 reserve0, uint112 reserve1, ) = pair.getReserves();
            uint256 totalSupply = pair.totalSupply();

            token0Amount = (uint256(reserve0) * lpBalance) / totalSupply;
            token1Amount = (uint256(reserve1) * lpBalance) / totalSupply;
        }
    }

    function isPlaygroundToken(address token) public view returns (bool) {
        if (token == address(0)) return false;

        try IPlaygroundToken(token).parent() returns (address parent) {
            return parent != address(0);
        } catch {
            return false;
        }
    }

    receive() external payable {
        // Allow contract to receive PLS
    }
}
