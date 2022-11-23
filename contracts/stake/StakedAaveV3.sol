// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import {IERC20} from '../interfaces/IERC20.sol';
import {StakedTokenV3} from './StakedTokenV3.sol';

/**
 * @title StakedAaveV3
 * @notice StakedTokenV3 with AAVE token as staked token
 * @author Aave
 **/
contract StakedAaveV3 is StakedTokenV3 {
  string internal constant NAME = 'Staked Aave';
  string internal constant SYMBOL = 'stkAAVE';
  uint8 internal constant DECIMALS = 18;

  constructor(
    IERC20 stakedToken,
    IERC20 rewardToken,
    uint256 cooldownSeconds,
    uint256 unstakeWindow,
    address rewardsVault,
    address emissionManager,
    uint128 distributionDuration,
    address governance
  )
    public
    StakedTokenV3(
      stakedToken,
      rewardToken,
      cooldownSeconds,
      unstakeWindow,
      rewardsVault,
      emissionManager,
      distributionDuration,
      NAME,
      SYMBOL,
      DECIMALS,
      governance
    )
  {}
}
