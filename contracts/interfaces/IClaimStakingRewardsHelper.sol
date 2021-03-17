pragma solidity ^0.7.5;

interface IClaimStakingRewardsHelper {
  function claimAllRewards(address to) external;

  function claimAllRewardsAndStake(address to) external;
}
