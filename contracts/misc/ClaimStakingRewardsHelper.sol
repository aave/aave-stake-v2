// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;

import {IClaimStakingRewardsHelper} from '../interfaces/IClaimStakingRewardsHelper.sol';
import {IStakedTokenV3} from '../interfaces/IStakedTokenV3.sol';

contract ClaimStakingRewardsHelper is IClaimStakingRewardsHelper {
  address[] public stakeTokens;

  constructor(address[] memory _stakeTokens) {
    stakeTokens = _stakeTokens;
  }

  function claimAllRewards(address to, uint256 amount) external override {
    for (uint256 i = 0; i < stakeTokens.length; i++) {
      IStakedTokenV3(stakeTokens[i]).claimRewardsOnBehalf(msg.sender, to, amount);
    }
  }

  function claimAllRewardsAndStake(address to, uint256 amount) external override {
    for (uint256 i = 0; i < stakeTokens.length; i++) {
      IStakedTokenV3(stakeTokens[i]).claimRewardsAndStakeOnBehalf(msg.sender, to, amount);
    }
  }
}
