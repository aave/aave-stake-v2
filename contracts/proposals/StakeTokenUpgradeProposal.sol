// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;
pragma abicoder v2;

import {IBaseAdminUpgradabilityProxy} from './../interfaces/IBaseAdminUpgradabilityProxy.sol';

contract StakeTokenUpgradeProposalExecutor {
  address constant SHORT_EXECUTOR = address(0xEE56e2B3D491590B5b31738cC34d5232F378a8D5);

  // TODO: Replace immutable with constant address when implementations are deployed
  // TODO: replace claimhelper for the real address when decided decided
  address immutable NEW_STAKED_AAVE_TOKEN_IMPLEMENTATION;
  address immutable NEW_STAKED_ABP_TOKEN_IMPLEMENTATION;
  address constant CLAIM_HELPER = SHORT_EXECUTOR;

  address constant SLASHING_ADMIN = SHORT_EXECUTOR;
  address constant COOLDOWN_PAUSE_ADMIN = SHORT_EXECUTOR;
  uint256 constant MAX_SLASHABLE_PERCENTAGE = 3000;

  IBaseAdminUpgradabilityProxy constant STAKED_AAVE_TOKEN_PROXY =
    IBaseAdminUpgradabilityProxy(0x4da27a545c0c5B758a6BA100e3a049001de870f5);
  IBaseAdminUpgradabilityProxy constant STAKED_ABP_TOKEN_PROXY =
    IBaseAdminUpgradabilityProxy(0xa1116930326D21fB917d5A27F1E9943A9595fb47);

  constructor(address newStakedAaveTokenImplementation, address newStakedAbpTokenImplementation) {
    NEW_STAKED_AAVE_TOKEN_IMPLEMENTATION = newStakedAaveTokenImplementation;
    NEW_STAKED_ABP_TOKEN_IMPLEMENTATION = newStakedAbpTokenImplementation;
  }

  function execute() external {
    _upgradeStakedAave();
    _upgradeStakedAbp();
  }

  function _upgradeStakedAave() internal {
    string memory name = 'Staked AAVE';
    string memory symbol = 'stkAAVE';
    uint8 decimals = 18;

    bytes memory params = abi.encodeWithSignature(
      'initialize(address,address,address,uint256,string,string,uint8)',
      SLASHING_ADMIN,
      COOLDOWN_PAUSE_ADMIN,
      CLAIM_HELPER,
      MAX_SLASHABLE_PERCENTAGE,
      name,
      symbol,
      decimals
    );

    STAKED_AAVE_TOKEN_PROXY.upgradeToAndCall(NEW_STAKED_AAVE_TOKEN_IMPLEMENTATION, params);
  }

  function _upgradeStakedAbp() internal {
    string memory name = 'Staked Aave Balance Pool Token';
    string memory symbol = 'stkABPT';
    uint8 decimals = 18;

    bytes memory params = abi.encodeWithSignature(
      'initialize(address,address,address,uint256,string,string,uint8)',
      SLASHING_ADMIN,
      COOLDOWN_PAUSE_ADMIN,
      CLAIM_HELPER,
      MAX_SLASHABLE_PERCENTAGE,
      name,
      symbol,
      decimals
    );

    STAKED_ABP_TOKEN_PROXY.upgradeToAndCall(NEW_STAKED_ABP_TOKEN_IMPLEMENTATION, params);
  }
}
