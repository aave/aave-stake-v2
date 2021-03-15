pragma solidity ^0.7.5;

interface IClaimStakingRewardsHelper {
  function claimAllRewards(
    address from,
    address to,
    uint256 amount
  ) external;

  function claimAllRewardsAndStake(
    address from,
    address to,
    uint256 amount
  ) external;
}
