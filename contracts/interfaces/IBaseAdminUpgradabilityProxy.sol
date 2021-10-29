pragma solidity ^0.7.5;

interface IBaseAdminUpgradabilityProxy {
  function upgradeTo(address newImplementation) external;

  function upgradeToAndCall(address newImplementation, bytes calldata data) external;

  function implementation() external returns (address);

  function admin() external returns (address);

  function changeAdmin(address newAdmin) external;
}
