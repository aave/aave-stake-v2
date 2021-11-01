// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;
pragma abicoder v2;

import {IBaseAdminUpgradabilityProxy} from './../interfaces/IBaseAdminUpgradabilityProxy.sol';

contract StakeTokenUpgradeProposalExecutor {
  address constant SHORT_EXECUTOR = address(0xEE56e2B3D491590B5b31738cC34d5232F378a8D5);

  // TODO: Replace immutable with constant address when implementation is deployed
  // TODO: replace claimhelper for the real address when decided decided
  address immutable NEW_STAKED_AAVE_TOKEN_IMPLEMENTATION;
  address constant claimHelper = SHORT_EXECUTOR;

  address constant slashingAdmin = SHORT_EXECUTOR;
  address constant cooldownPauseAdmin = SHORT_EXECUTOR;
  uint256 constant maxSlashablePercentage = 3000;
  string constant name = 'Staked AAVE';
  string constant symbol = 'stkAAVE';
  uint8 constant decimals = 18;

  IBaseAdminUpgradabilityProxy constant STAKED_AAVE_TOKEN_PROXY =
    IBaseAdminUpgradabilityProxy(0x4da27a545c0c5B758a6BA100e3a049001de870f5);

  constructor(address newStakedAaveTokenImplementation) {
    NEW_STAKED_AAVE_TOKEN_IMPLEMENTATION = newStakedAaveTokenImplementation;
  }

  function execute() external {
    bytes memory params = abi.encodeWithSignature(
      'initialize(address,address,address,uint256,string,string,uint8)',
      slashingAdmin,
      cooldownPauseAdmin,
      claimHelper,
      maxSlashablePercentage,
      name,
      symbol,
      decimals
    );

    STAKED_AAVE_TOKEN_PROXY.upgradeToAndCall(NEW_STAKED_AAVE_TOKEN_IMPLEMENTATION, params);
  }
}
