// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;

import {IClaimStakingRewardsHelper} from '../interfaces/IClaimStakingRewardsHelper.sol';
import {IStakedTokenV3} from '../interfaces/IStakedTokenV3.sol';
import {IERC20} from '../interfaces/IERC20.sol';

contract ClaimStakingRewardsHelper is IClaimStakingRewardsHelper {
  address public immutable aaveStakeToken;
  address public immutable bptStakeToken;

  constructor(
    address _aaveStakeToken,
    address _bptStakeToken,
    address aaveToken
  ) {
    aaveStakeToken = _aaveStakeToken;
    bptStakeToken = _bptStakeToken;

    IERC20(aaveToken).approve(_aaveStakeToken, type(uint256).max);
  }

  function claimAllRewards(address to, uint256 amount) external override {
    IStakedTokenV3(aaveStakeToken).claimRewardsOnBehalf(msg.sender, to, amount);
    IStakedTokenV3(bptStakeToken).claimRewardsOnBehalf(msg.sender, to, amount);
  }

  function claimAllRewardsAndStake(address to, uint256 amount) external override {
    IStakedTokenV3(aaveStakeToken).claimRewardsAndStakeOnBehalf(msg.sender, to, amount);

    uint256 rewardsClaimed =
      IStakedTokenV3(bptStakeToken).claimRewardsOnBehalf(msg.sender, address(this), amount);
    IStakedTokenV3(aaveStakeToken).stake(to, rewardsClaimed);
  }
}
