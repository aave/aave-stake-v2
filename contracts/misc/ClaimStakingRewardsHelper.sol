// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;

import {IClaimStakingRewardsHelper} from '../interfaces/IClaimStakingRewardsHelper.sol';
import {IStakedTokenV3} from '../interfaces/IStakedTokenV3.sol';
import {IERC20} from '../interfaces/IERC20.sol';

contract ClaimStakingRewardsHelper is IClaimStakingRewardsHelper {
  address public immutable aaveStakeToken;
  address public immutable bptStakeToken;
  address public immutable aaveToken;

  constructor(
    address _aaveStakeToken,
    address _bptStakeToken,
    address _aaveToken
  ) {
    aaveStakeToken = _aaveStakeToken;
    bptStakeToken = _bptStakeToken;
    aaveToken = _aaveToken;
  }

  function claimAllRewards(address to, uint256 amount) external override {
    IStakedTokenV3(aaveStakeToken).claimRewardsOnBehalf(msg.sender, to, amount);
    IStakedTokenV3(bptStakeToken).claimRewardsOnBehalf(msg.sender, to, amount);
  }

  function claimAllRewardsAndStake(address to, uint256 amount) external override {
    IStakedTokenV3(aaveStakeToken).claimRewardsAndStakeOnBehalf(msg.sender, to, amount);

    uint256 rewardsClaimed =
      IStakedTokenV3(bptStakeToken).claimRewardsOnBehalf(msg.sender, address(this), amount);

    IERC20(aaveToken).approve(address(this), rewardsClaimed);
    IStakedTokenV3(aaveStakeToken).stake(to, rewardsClaimed);
  }
}
