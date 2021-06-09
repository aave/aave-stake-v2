// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import {SafeMath} from '../lib/SafeMath.sol';
import {AaveDistributionManager} from './AaveDistributionManager.sol';

/**
 * @title AaveDistributionManagerV2
 * @notice Accounting contract to manage multiple staking distributions
 * @author Aave
 **/
contract AaveDistributionManagerV2 is AaveDistributionManager {
  using SafeMath for uint256;

  uint256 internal _distributionEnd;

  event DistributionEndUpdated(uint256 ditributionEnd);

  constructor(address emissionManager) AaveDistributionManager(emissionManager, 0) {}

  /**
   * @dev Returns the timestamp of the end of the current distribution
   * @return uint256 unix timestamp
   **/
  function getDistributionEnd() external view returns (uint256) {
    return _distributionEnd;
  }

  /**
   * @dev Extends the end of the distribution in regards of current timestamp.
   * @param distributionEnd The unix timestamp of the next distribution end
   **/
  function setDistributionEnd(uint256 distributionEnd) public onlyEmissionManager {
    _distributionEnd = distributionEnd;
    emit DistributionEndUpdated(_distributionEnd);
  }

  /**
   * @dev Returns the timestamp of the end of the current distribution
   * Used to replace the immutable in the parent class
   * @return uint256 unix timestamp
   **/
  function _getDistributionEnd() internal view override returns (uint256) {
    return _distributionEnd;
  }

  /**
   * @dev Returns the configuration of the distribution for a certain asset
   * @param asset The address of the reference asset of the distribution
   * @return The asset index, the emission per second and the last updated timestamp
   **/
  function getAssetData(address asset)
    public
    view
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    return (
      assets[asset].index,
      assets[asset].emissionPerSecond,
      assets[asset].lastUpdateTimestamp
    );
  }
}
