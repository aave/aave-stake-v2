pragma solidity ^0.7.5;
pragma abicoder v2;

interface IConfigurableRightsPool {
  function bPool() external view returns (address);

  // function createPool(uint, uint, uint) external ;
  function joinPool(uint256 poolAmountOut, uint256[] calldata maxAmountsIn) external;

  function setCap(uint256 newCap) external;

  function setController(address newOwner) external;

  function setPublicSwap(bool publicSwap) external;

  function createPool(uint256) external;
}
