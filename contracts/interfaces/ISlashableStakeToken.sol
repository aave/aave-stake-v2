
// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;

import {IStakedToken} from "./IStakedToken.sol";

interface ISlashableStakeToken is IStakedToken {
 
  function exchangeRate() external view returns(uint256);

  function getCooldownPaused() external view returns(bool);
  function setCooldownPause(bool paused) external;

  function slash(address destination, uint256 amount) external;

  function getMaxSlashablePercentage() external view returns(uint256);
  function setMaxSlashablePercentage(uint256 percentage) external;
}
