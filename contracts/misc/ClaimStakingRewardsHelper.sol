// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;

import {IClaimStakingRewardsHelper} from '../interfaces/IClaimStakingRewardsHelper.sol';
import {IStakedTokenV3} from '../interfaces/IStakedTokenV3.sol';
import {IERC20} from '../interfaces/IERC20.sol';

/**
 * @title ClaimStakingRewardsHelper
 * @notice Contract to claim all rewards on the different stake pools
 * or claim all and stake Aave token
 * @author Aave
 **/
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

  /**
   * @dev Claims all reward for an user, on all the different staked assets.
   * @param to Address that will be receiving the rewards
   **/
  function claimAllRewards(address to) external override {
    IStakedTokenV3(aaveStakeToken).claimRewardsOnBehalf(msg.sender, to, type(uint256).max);
    IStakedTokenV3(bptStakeToken).claimRewardsOnBehalf(msg.sender, to, type(uint256).max);
  }

  /**
   * @dev Claims all reward for an user, on all the different staked assets, and stakes this amount on the aave stake pool.
   * @param to Address that will be receiving the stk Token representing the staked amount
   **/
  function claimAllRewardsAndStake(address to) external override {
    IStakedTokenV3(aaveStakeToken).claimRewardsAndStakeOnBehalf(msg.sender, to, type(uint256).max);

    uint256 rewardsClaimed =
      IStakedTokenV3(bptStakeToken).claimRewardsOnBehalf(
        msg.sender,
        address(this),
        type(uint256).max
      );
    IStakedTokenV3(aaveStakeToken).stake(to, rewardsClaimed);
  }
}
