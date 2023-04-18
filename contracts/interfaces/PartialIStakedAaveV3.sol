// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;

interface PartialIStakedAaveV3 {
  function totalSupply() external view returns (uint256);

  function balanceOf(address account) external view returns (uint256);

  function COOLDOWN_SECONDS() external view returns (uint256); // TODO

  function UNSTAKE_WINDOW() external view returns (uint256);

  function DISTRIBUTION_END() external view returns (uint256);

  function STAKED_TOKEN() external view returns (address);

  function getTotalRewardsBalance(address staker) external view returns (uint256);

  function stakersCooldowns(address) external view returns (uint40 timestamp, uint216 amount);

  function previewRedeem(uint256 shares) external view returns (uint256);
}
