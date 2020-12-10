pragma solidity ^0.7.5;

interface IAToken {
  function getScaledUserBalanceAndSupply(address user) external view returns (uint256, uint256);
}
