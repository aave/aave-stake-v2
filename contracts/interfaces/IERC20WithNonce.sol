// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;

import {IERC20} from '../lib/ERC20.sol';

interface IERC20WithNonce is IERC20 {
  function _nonces(address user) external view returns (uint256);
}
