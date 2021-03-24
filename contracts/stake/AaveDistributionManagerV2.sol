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

  event DistributionEndUpdate(uint256 ditributionEnd, uint256 distributionDuration);

  constructor(address emissionManager) AaveDistributionManager(emissionManager, 0) {}

  /**
   * @dev Returns the timestamp of the end of the current distribution
   * @return uint256 unix timestamp
   **/
  function getDistributionEnd() external view returns (uint256) {
    return _getDistributionEnd();
  }

  /**
   * @dev Extends the end of the distribution in regards of current timestamp.
   * @param distributionDuration The unix timestamp duration of the new distribution
   **/
  function _extendDistribution(uint256 distributionDuration) internal {
    _distributionEnd = block.timestamp.add(distributionDuration);
    emit DistributionEndUpdate(_distributionEnd, distributionDuration);
  }

  /**
   * @dev Returns the timestamp of the end of the current distribution
   * @return uint256 unix timestamp
   **/
  function _getDistributionEnd() internal view override returns (uint256) {
    return _distributionEnd;
  }
}
