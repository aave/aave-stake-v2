// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

interface IAaveIncentivesController {
  function handleAction(
    address asset,
    uint256 userBalance,
    uint256 totalSupply
  ) external;

  function getRewardsBalance(address[] calldata assets, address user)
    external
    view
    returns (uint256);

  function claimRewards(
    address[] calldata assets,
    uint256 amount,
    address to
  ) external returns (uint256);

  function claimRewardsOnBehalf(
    address[] calldata assets,
    uint256 amount,
    address from,
    address to
  ) external returns (uint256);

  function allowClaimOnBehalf(address user, address caller) external;

  function getAllowedToClaimOnBehalf(address user) external view returns (address);
}
