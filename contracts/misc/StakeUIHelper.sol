// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import {IStakedToken} from './IStakedToken.sol';
import {IStakeUIHelper} from '../interfaces/IStakeUIHelper.sol';
import {IERC20WithNonce} from '../interfaces/IERC20WithNonce.sol';
import {IERC20} from '../interfaces/IERC20.sol';
import {IPriceOracle} from '../interfaces/IPriceOracle.sol';

interface BPTPriceFeedI {
  function latestAnswer() external view returns (uint256);
}

contract StakeUIHelper is IStakeUIHelper {
  IPriceOracle public immutable PRICE_ORACLE;
  BPTPriceFeedI public immutable BPT_PRICE_FEED;

  address public immutable AAVE;
  IStakedToken public immutable STAKED_AAVE;

  address public immutable BPT;
  IStakedToken public immutable STAKED_BPT;

  uint256 constant SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
  uint256 constant APY_PRECISION = 10000;
  address constant MOCK_USD_ADDRESS = 0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96;
  uint256 internal constant USD_BASE = 1e26;

  constructor(
    IPriceOracle priceOracle,
    BPTPriceFeedI bptPriceFeed,
    address aave,
    IStakedToken stkAave,
    address bpt,
    IStakedToken stkBpt
  ) public {
    PRICE_ORACLE = priceOracle;
    BPT_PRICE_FEED = bptPriceFeed;

    AAVE = aave;
    STAKED_AAVE = stkAave;

    BPT = bpt;
    STAKED_BPT = stkBpt;
  }

  function _getStakedAssetData(
    IStakedToken stakeToken,
    address underlyingToken,
    address user,
    bool isNonceAvailable
  ) internal view returns (AssetUIData memory) {
    AssetUIData memory data;

    data.stakeTokenTotalSupply = stakeToken.totalSupply();
    data.stakeCooldownSeconds = stakeToken.COOLDOWN_SECONDS();
    data.stakeUnstakeWindow = stakeToken.UNSTAKE_WINDOW();
    data.rewardTokenPriceEth = PRICE_ORACLE.getAssetPrice(AAVE);
    data.distributionEnd = stakeToken.DISTRIBUTION_END();
    if (block.timestamp < data.distributionEnd) {
      data.distributionPerSecond = stakeToken.assets(address(stakeToken)).emissionPerSecond;
    }

    if (user != address(0)) {
      data.underlyingTokenUserBalance = IERC20(underlyingToken).balanceOf(user);
      data.stakeTokenUserBalance = stakeToken.balanceOf(user);
      data.userIncentivesToClaim = stakeToken.getTotalRewardsBalance(user);
      data.userCooldown = stakeToken.stakersCooldowns(user);
      data.userPermitNonce = isNonceAvailable ? IERC20WithNonce(underlyingToken)._nonces(user) : 0;
    }
    return data;
  }

  function _calculateApy(uint256 distributionPerSecond, uint256 stakeTokenTotalSupply)
    internal
    pure
    returns (uint256)
  {
    return (distributionPerSecond * SECONDS_PER_YEAR * APY_PRECISION) / stakeTokenTotalSupply;
  }

  function getStkAaveData(address user) public view override returns (AssetUIData memory) {
    AssetUIData memory data = _getStakedAssetData(STAKED_AAVE, AAVE, user, true);

    data.stakeTokenPriceEth = data.rewardTokenPriceEth;
    data.stakeApy = _calculateApy(data.distributionPerSecond, data.stakeTokenTotalSupply);
    return data;
  }

  function getStkBptData(address user) public view override returns (AssetUIData memory) {
    AssetUIData memory data = _getStakedAssetData(STAKED_BPT, BPT, user, false);

    data.stakeTokenPriceEth = address(BPT_PRICE_FEED) != address(0)
      ? BPT_PRICE_FEED.latestAnswer()
      : PRICE_ORACLE.getAssetPrice(BPT);
    data.stakeApy = _calculateApy(
      data.distributionPerSecond * data.rewardTokenPriceEth,
      data.stakeTokenTotalSupply * data.stakeTokenPriceEth
    );

    return data;
  }

  function getUserUIData(address user)
    external
    view
    override
    returns (
      AssetUIData memory,
      AssetUIData memory,
      uint256
    )
  {
    return (
      getStkAaveData(user),
      getStkBptData(user),
      USD_BASE / PRICE_ORACLE.getAssetPrice(MOCK_USD_ADDRESS)
    );
  }
}
