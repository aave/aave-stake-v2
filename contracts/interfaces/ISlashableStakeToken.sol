
// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;

interface ISlashableStakeToken {
    
  function stake(address to, uint256 amount) external;

  function redeem(address to, uint256 amount) external;

  function cooldown() external;

  function claimRewards(address to, uint256 amount) external;

  function exchangeRate() external view returns(uint256);

  function setCooldownPause(bool paused) external;

  function slash(address destination, uint256 amount) external;

  function getCooldownPauseAdmin() external view returns(address);
  function setCooldownPauseAdmin(address admin) external;

  function getSlashingAdmin() external view returns(address);
  function setSlashingAdmin(address admin) external;
  
}
