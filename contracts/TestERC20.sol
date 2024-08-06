// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TestERC20
 * @dev Implementation of the ERC20 token for testing purposes.
 */
contract TestERC20 is ERC20 {
    uint8 private _customDecimals;

    /**
     * @dev Sets the values for {name}, {symbol}, and {decimals}, and mints initial supply to the deployer account.
     *
     * All three of these values are immutable: they can only be set once during construction.
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) {
        _customDecimals = decimals_;
        // Mint an initial supply of 1,000,000 tokens to the deployer's address
        _mint(msg.sender, 1_000_000 * (10 ** uint256(decimals_)));
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5.05` (`505 / 10 ** 2`).
     *
     * This function overrides the default ERC20 `decimals` function to return the custom decimals set during construction.
     */
    function decimals() public view virtual override returns (uint8) {
        return _customDecimals;
    }
}
