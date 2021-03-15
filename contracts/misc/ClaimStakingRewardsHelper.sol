// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;

import {IClaimStakingRewardsHelper} from '../interfaces/IClaimStakingRewardsHelper.sol';
import {IStakedTokenV3} from '../interfaces/IStakedTokenV3.sol';

contract ClaimStakingRewardsHelper is IClaimStakingRewardsHelper {
  address public immutable aaveStakeToken;
  address public immutable bptStakeToken;

  constructor(address _aaveStakeToken, address _bptStakeToken) {
    aaveStakeToken = _aaveStakeToken;
    bptStakeToken = _bptStakeToken;
  }

  function claimAllRewards(address to, uint256 amount) external override {
    IStakedTokenV3(aaveStakeToken).claimRewardsOnBehalf(msg.sender, to, amount);
    IStakedTokenV3(bptStakeToken).claimRewardsOnBehalf(msg.sender, to, amount);
  }

  function claimAllRewardsAndStake(address to, uint256 amount) external override {
    IStakedTokenV3(aaveStakeToken).claimRewardsAndStakeOnBehalf(msg.sender, to, amount);
    IStakedTokenV3(bptStakeToken).claimRewardsAndStakeOnBehalf(msg.sender, to, amount);
  }
}
