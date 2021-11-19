// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;

import {IStakedToken} from './IStakedToken.sol';

interface IStakedTokenV3 is IStakedToken {
  function exchangeRate() external view returns (uint256);

  function getCooldownPaused() external view returns (bool);

  function setCooldownPause(bool paused) external;

  function getEmergencyShutdown() external view returns (bool);

  function setEmergencyShutdown(bool emergencyShutdown) external;

  function slash(address destination, uint256 amount) external;

  function getMaxSlashablePercentage() external view returns (uint256);

  function setMaxSlashablePercentage(uint256 percentage) external;

  function stakeWithPermit(
    address from,
    address to,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external;

  function claimRewardsOnBehalf(
    address from,
    address to,
    uint256 amount
  ) external returns (uint256);

  function redeemOnBehalf(
    address from,
    address to,
    uint256 amount
  ) external;

  function claimRewardsAndStake(address to, uint256 amount) external returns (uint256);

  function claimRewardsAndRedeem(
    address to,
    uint256 claimAmount,
    uint256 redeemAmount
  ) external;

  function claimRewardsAndStakeOnBehalf(
    address from,
    address to,
    uint256 amount
  ) external returns (uint256);

  function claimRewardsAndRedeemOnBehalf(
    address from,
    address to,
    uint256 claimAmount,
    uint256 redeemAmount
  ) external;
}
