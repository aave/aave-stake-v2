// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;
pragma abicoder v2;

import {IBaseAdminUpgradabilityProxy} from './../interfaces/IBaseAdminUpgradabilityProxy.sol';

contract StakeTokenUpgradeProposalExecutor {
  // TODO: Replace with constant address when implementation is deployed
  address immutable NEW_STAKED_AAVE_TOKEN_IMPLEMENTATION;

  constructor(address newStakedAaveTokenImplementation) {
    NEW_STAKED_AAVE_TOKEN_IMPLEMENTATION = newStakedAaveTokenImplementation;
  }

  IBaseAdminUpgradabilityProxy constant STAKED_AAVE_TOKEN_PROXY =
    IBaseAdminUpgradabilityProxy(0x4da27a545c0c5B758a6BA100e3a049001de870f5);

  function execute() external {
    STAKED_AAVE_TOKEN_PROXY.upgradeTo(NEW_STAKED_AAVE_TOKEN_IMPLEMENTATION);
  }
}
