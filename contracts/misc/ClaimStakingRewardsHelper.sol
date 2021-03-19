// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;

import {IClaimStakingRewardsHelper} from '../interfaces/IClaimStakingRewardsHelper.sol';
import {IStakedTokenV3} from '../interfaces/IStakedTokenV3.sol';
import {IERC20} from '../interfaces/IERC20.sol';
import {SafeMath} from '../lib/SafeMath.sol';

/**
 * @title ClaimStakingRewardsHelper
 * @notice Contract to claim all rewards on the different stake pools
 * or claim all and stake Aave token
 * @author Aave
 **/
contract ClaimStakingRewardsHelper is IClaimStakingRewardsHelper {
  using SafeMath for uint256;
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
  function claimAllRewards(address to) external override returns (uint256) {
    uint256 claimedFromAave =
      IStakedTokenV3(aaveStakeToken).claimRewardsOnBehalf(msg.sender, to, type(uint256).max);
    uint256 claimedFromBPT =
      IStakedTokenV3(bptStakeToken).claimRewardsOnBehalf(msg.sender, to, type(uint256).max);
    return claimedFromAave.add(claimedFromBPT);
  }

  /**
   * @dev Claims all reward for an user, on all the different staked assets, and stakes this amount on the aave stake pool.
   * @param to Address that will be receiving the stk Token representing the staked amount
   **/
  function claimAllRewardsAndStake(address to) external override {
    _claimAndStake(to, aaveStakeToken);
    _claimAndStake(to, bptStakeToken);
  }

  /**
   * @dev Claims reward from stakedToken and stakes it into the aave stake pool
   * @param to Address that will be receiving the stk Token representing the staked amount
   * @param stakeToken Address of the stake token where to claim the rewards
   **/
  function claimAndStake(address to, address stakeToken) external override {
    require(
      stakeToken == aaveStakeToken || stakeToken == bptStakeToken,
      'Staked Token address must exists'
    );
    _claimAndStake(to, stakeToken);
  }

  /**
   * @dev Claims reward from stakedToken and stakes it into the aave stake pool
   * @param to Address that will be receiving the stk Token representing the staked amount
   **/
  function _claimAndStake(address to, address stakeToken) internal {
    uint256 rewardsClaimed =
      IStakedTokenV3(stakeToken).claimRewardsOnBehalf(msg.sender, address(this), type(uint256).max);
    if (rewardsClaimed > 0) {
      IStakedTokenV3(aaveStakeToken).stake(to, rewardsClaimed);
    }
  }
}
