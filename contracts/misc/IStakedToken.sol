// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

interface IStakedToken {
  struct AssetData {
    uint128 emissionPerSecond;
    uint128 lastUpdateTimestamp;
    uint256 index;
  }

  function totalSupply() external view returns (uint256);

  function COOLDOWN_SECONDS() external view returns (uint256);

  function UNSTAKE_WINDOW() external view returns (uint256);

  function DISTRIBUTION_END() external view returns (uint256);

  function assets(address asset) external view returns (AssetData memory);

  function balanceOf(address user) external view returns (uint256);

  function getTotalRewardsBalance(address user) external view returns (uint256);

  function stakersCooldowns(address user) external view returns (uint256);

  function stake(address to, uint256 amount) external;

  function redeem(address to, uint256 amount) external;

  function cooldown() external;

  function claimRewards(address to, uint256 amount) external;
}
