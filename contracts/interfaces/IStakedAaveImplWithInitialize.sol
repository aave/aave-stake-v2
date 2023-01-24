// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;

interface IStakedAaveImplWithInitialize {
  function initialize(
    address aaveGovernance,
    string calldata name,
    string calldata symbol,
    uint8 decimals
  ) external;

  function stake(address onBehalfOf, uint256 amount) external;

  function redeem(address to, uint256 amount) external;

  function cooldown() external;

  function claimRewards(address to, uint256 amount) external;

  function balanceOf(address user) external view returns (uint256);
}
