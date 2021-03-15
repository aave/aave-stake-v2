pragma solidity ^0.7.5;

interface IClaimStakingRewardsHelper {
  function claimAllRewards(address to, uint256 amount) external;

  // function claimAllRewardsAndStake(address to, uint256 amount) external;
}
