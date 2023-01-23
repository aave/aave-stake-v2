// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;

interface BPTPriceFeedI {
  function latestAnswer() external view returns (uint256);
}
