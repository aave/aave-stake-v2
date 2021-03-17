pragma solidity ^0.7.5;

interface IClaimStakingRewardsHelper {
  function claimAllRewards(address to) external returns (uint256);

  function claimAllRewardsAndStake(address to) external;

  function claimAndStake(address to, address stakeToken) external;
}
