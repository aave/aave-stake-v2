// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;

import {IStakedAaveImplWithInitialize} from '../interfaces/IStakedAaveImplWithInitialize.sol';
import {IEIP2612Token} from '../interfaces/IEIP2612Token.sol';

/**
 * @title StakingHelper contract
 * @author Aave
 * @dev implements a staking function that allows staking through the EIP2612 capabilities of the AAVE token
 **/

contract AaveStakingHelper {
  IStakedAaveImplWithInitialize public immutable STAKE;
  IEIP2612Token public immutable AAVE;

  constructor(address stake, address aave) public {
    STAKE = IStakedAaveImplWithInitialize(stake);
    AAVE = IEIP2612Token(aave);
    //approves the stake to transfer uint256.max tokens from this contract
    //avoids approvals on every stake action
    IEIP2612Token(aave).approve(address(stake), type(uint256).max);
  }

  /**
   * @dev stakes on behalf of msg.sender using signed approval.
   * The function expects a valid signed message from the user, and executes a permit()
   * to approve the transfer. The helper then stakes on behalf of the user
   * @param user the user for which the staking is being executed
   * @param amount the amount to stake
   * @param v signature param
   * @param r signature param
   * @param s signature param
   **/
  function stake(
    address user,
    uint256 amount,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {
    AAVE.permit(user, address(this), amount, type(uint256).max, v, r, s);
    AAVE.transferFrom(user, address(this), amount);
    STAKE.stake(user, amount);
  }
}
