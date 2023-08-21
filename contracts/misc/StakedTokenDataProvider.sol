// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import {IERC20} from '../interfaces/IERC20.sol';
import {AggregatedStakedAaveV3} from '../interfaces/AggregatedStakedAaveV3.sol';
import {IStakedToken} from '../interfaces/IStakedToken.sol';
import {AggregatorInterface} from '../interfaces/AggregatorInterface.sol';
import {IStakedTokenDataProvider} from '../interfaces/IStakedTokenDataProvider.sol';

/**
 * @title StakedTokenDataProvider
 * @notice Data provider contract for Staked Tokens of the Safety Module (e.g. AAVE:StkAAVE and BPT:StkBPT)
 */
contract StakedTokenDataProvider is IStakedTokenDataProvider {
  /// @inheritdoc IStakedTokenDataProvider
  address public immutable override ETH_USD_PRICE_FEED;

  /// @inheritdoc IStakedTokenDataProvider
  address public immutable override AAVE_PRICE_FEED;

  /// @inheritdoc IStakedTokenDataProvider
  address public immutable override AAVE;

  /// @inheritdoc IStakedTokenDataProvider
  address public immutable override STAKED_AAVE;

  uint256 private constant SECONDS_PER_YEAR = 365 days;

  uint256 private constant APY_PRECISION = 10000;

  /**
   * @dev Constructor
   * @param aave The address of the StkAAVE token
   * @param stkAave The address of the StkAAVE token
   * @param ethUsdPriceFeed The address of ETH price feed (USD denominated, with 8 decimals)
   * @param aavePriceFeed The address of AAVE price feed (ETH denominated, with 18 decimals)
   */
  constructor(
    address aave,
    address stkAave,
    address ethUsdPriceFeed,
    address aavePriceFeed
  ) public {
    AAVE = aave;
    STAKED_AAVE = stkAave;
    ETH_USD_PRICE_FEED = ethUsdPriceFeed;
    AAVE_PRICE_FEED = aavePriceFeed;
  }

  /// @inheritdoc IStakedTokenDataProvider
  function getStakedAssetDataBatch(
    address[] calldata stakedTokens,
    address[] calldata oracleAddresses
  )
    external
    view
    override
    returns (
      StakedTokenData[] memory,
      uint256[] memory,
      uint256[] memory
    )
  {
    require(stakedTokens.length == oracleAddresses.length, 'Arrays must be of the same length');

    StakedTokenData[] memory stakedData = new StakedTokenData[](stakedTokens.length);
    uint256[] memory prices = new uint256[](oracleAddresses.length);
    uint256[] memory ethPrice = new uint256[](stakedTokens.length);

    for (uint256 i = 0; i < stakedTokens.length; i++) {
      stakedData[i] = _getStakedTokenData(
        AggregatedStakedAaveV3(stakedTokens[i]),
        oracleAddresses[i]
      );
      prices[i] = uint256(AggregatorInterface(oracleAddresses[i]).latestAnswer());
      ethPrice[i] = uint256(AggregatorInterface(ETH_USD_PRICE_FEED).latestAnswer());
    }
    return (stakedData, prices, ethPrice);
  }

  /// @inheritdoc IStakedTokenDataProvider
  function getStakedUserDataBatch(
    address[] calldata stakedTokens,
    address[] calldata oracleAddresses,
    address[] calldata userAddresses
  ) external view override returns (StakedTokenData[] memory, StakedTokenUserData[] memory) {
    require(
      stakedTokens.length == oracleAddresses.length && stakedTokens.length == userAddresses.length,
      'All arrays must be of the same length'
    );
    StakedTokenData[] memory stakedData = new StakedTokenData[](stakedTokens.length);
    StakedTokenUserData[] memory userData = new StakedTokenUserData[](userAddresses.length);

    for (uint256 i = 0; i < stakedTokens.length; i++) {
      stakedData[i] = _getStakedTokenData(
        AggregatedStakedAaveV3(stakedTokens[i]),
        oracleAddresses[i]
      );
      userData[i] = _getStakedTokenUserData(
        AggregatedStakedAaveV3(stakedTokens[i]),
        userAddresses[i]
      );
    }
    return (stakedData, userData);
  }

  /// @inheritdoc IStakedTokenDataProvider
  function getStakedAssetData(address stakedAsset, address oracleAddress)
    external
    view
    override
    returns (StakedTokenData memory)
  {
    return _getStakedTokenData(AggregatedStakedAaveV3(stakedAsset), oracleAddress);
  }

  /// @inheritdoc IStakedTokenDataProvider
  function getStakedUserData(
    address user,
    address stakedAsset,
    address oracleAddress
  ) external view override returns (StakedTokenData memory, StakedTokenUserData memory) {
    return (
      _getStakedTokenData(AggregatedStakedAaveV3(stakedAsset), oracleAddress),
      _getStakedTokenUserData(AggregatedStakedAaveV3(stakedAsset), user)
    );
  }

  /**
   * @notice Returns data of the Staked Token passed as parameter
   * @param stakedToken The address of the StakedToken (eg. stkAave, stkBptAave)
   * @return data An object with general data of the StakedToken
   */
  function _getStakedTokenData(AggregatedStakedAaveV3 stakedToken, address oracleAddress)
    internal
    view
    returns (StakedTokenData memory data)
  {
    data.stakedTokenTotalSupply = stakedToken.totalSupply();
    data.stakedTokenTotalRedeemableAmount = stakedToken.previewRedeem(data.stakedTokenTotalSupply);
    data.stakeCooldownSeconds = stakedToken.COOLDOWN_SECONDS();
    data.stakeUnstakeWindow = stakedToken.UNSTAKE_WINDOW();
    data.rewardTokenPriceEth = uint256(AggregatorInterface(AAVE_PRICE_FEED).latestAnswer());
    data.distributionEnd = stakedToken.DISTRIBUTION_END();
    data.inPostSlashingPeriod = stakedToken.inPostSlashingPeriod();

    data.distributionPerSecond = block.timestamp < data.distributionEnd
      ? stakedToken.assets(address(stakedToken)).emissionPerSecond
      : 0;

    // stkAave
    if (address(stakedToken) == STAKED_AAVE) {
      data.stakedTokenPriceEth = data.rewardTokenPriceEth;
      // assumes AAVE and stkAAVE have the same value
      data.stakeApy = _calculateApy(data.distributionPerSecond, data.stakedTokenTotalSupply);

      // other wrapped assets
    } else {
      data.stakedTokenPriceEth = uint256(AggregatorInterface(oracleAddress).latestAnswer());
      data.stakeApy = _calculateApy(
        data.distributionPerSecond * data.rewardTokenPriceEth,
        data.stakedTokenTotalSupply * data.stakedTokenPriceEth
      );
    }
  }

  /**
   * @notice Calculates the APY of the reward distribution among StakedToken holders
   * @dev It uses the value of the reward and StakedToken asset
   * @param distributionPerSecond The value of the rewards being distributed per second
   * @param stakedTokenTotalSupply The value of the total supply of StakedToken asset
   */
  function _calculateApy(uint256 distributionPerSecond, uint256 stakedTokenTotalSupply)
    internal
    pure
    returns (uint256)
  {
    if (stakedTokenTotalSupply == 0) return 0;
    return (distributionPerSecond * SECONDS_PER_YEAR * APY_PRECISION) / stakedTokenTotalSupply;
  }

  /**
   * @notice Returns user data of the Staked Token
   * @param stakedToken The address of the StakedToken asset
   * @param user The address of the user
   */
  function _getStakedTokenUserData(AggregatedStakedAaveV3 stakedToken, address user)
    internal
    view
    returns (StakedTokenUserData memory data)
  {
    data.stakedTokenUserBalance = stakedToken.balanceOf(user);
    data.rewardsToClaim = stakedToken.getTotalRewardsBalance(user);
    data.underlyingTokenUserBalance = IERC20(stakedToken.STAKED_TOKEN()).balanceOf(user);
    data.stakedTokenRedeemableAmount = stakedToken.previewRedeem(data.stakedTokenUserBalance);
    (data.userCooldownTimestamp, data.userCooldownAmount) = stakedToken.stakersCooldowns(user);
  }
}
