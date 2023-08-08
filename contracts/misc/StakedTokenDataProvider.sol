// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import {IERC20} from '../interfaces/IERC20.sol';
import {AggregatedStakedAaveV3} from '../interfaces/AggregatedStakedAaveV3.sol';
import {IStakedToken} from '../interfaces/IStakedToken.sol';
import {AggregatorInterface} from '../interfaces/AggregatorInterface.sol';
import {IStakedTokenDataProvider} from '../interfaces/IStakedTokenDataProvider.sol';
import 'hardhat/console.sol';

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
  address public immutable override BPT_PRICE_FEED;

  /// @inheritdoc IStakedTokenDataProvider
  address public immutable override AAVE;

  /// @inheritdoc IStakedTokenDataProvider
  address public immutable override STAKED_AAVE;

  /// @inheritdoc IStakedTokenDataProvider
  address public immutable override BPT;

  /// @inheritdoc IStakedTokenDataProvider
  address public immutable override STAKED_BPT;

  /// @inheritdoc IStakedTokenDataProvider
  address public immutable override STAKED_BPT_WSTETH;

  /// @inheritdoc IStakedTokenDataProvider
  address public immutable override BPT_STETH_PRICE_FEED;

  uint256 private constant SECONDS_PER_YEAR = 365 days;

  uint256 private constant APY_PRECISION = 10000;

  /**
   * @dev Constructor
   * @param aave The address of the AAVE token
   * @param stkAave The address of the StkAAVE token
   * @param bpt The address of the BPT AAVE / ETH token
   * @param stkBpt The address of the StkBptAAVE token
   * @param ethUsdPriceFeed The address of ETH price feed (USD denominated, with 8 decimals)
   * @param aavePriceFeed The address of AAVE price feed (ETH denominated, with 18 decimals)
   * @param bptPriceFeed The address of StakedBpt price feed (ETH denominated, with 18 decimals)
   * @param bptWstETH The address of stETH token
   * @param bptWstETHPriceFeed The address of stEth price feed (ETH denominated, with 18 decimals)

   */
  constructor(
    address aave,
    address stkAave,
    address bpt,
    address stkBpt,
    address ethUsdPriceFeed,
    address aavePriceFeed,
    address bptPriceFeed,
    address bptWstETH,
    address bptWstETHPriceFeed
  ) public {
    AAVE = aave;
    STAKED_AAVE = stkAave;
    BPT = bpt;
    STAKED_BPT = stkBpt;
    ETH_USD_PRICE_FEED = ethUsdPriceFeed;
    AAVE_PRICE_FEED = aavePriceFeed;
    BPT_PRICE_FEED = bptPriceFeed;

    STAKED_BPT_WSTETH = bptWstETH;
    BPT_STETH_PRICE_FEED = bptWstETHPriceFeed;
  }

  /// @inheritdoc IStakedTokenDataProvider
  function getAllStakedTokenData()
    external
    view
    override
    returns (
      StakedTokenData memory stkAaveData,
      StakedTokenData memory stkBptData,
      StakedTokenData memory stkBptWstETHData,
      uint256 ethPrice
    )
  {
    stkAaveData = _getStakedTokenData(AggregatedStakedAaveV3(STAKED_AAVE));
    stkBptData = _getStakedTokenData(AggregatedStakedAaveV3(STAKED_BPT));
    stkBptWstETHData = _getStakedTokenData(AggregatedStakedAaveV3(STAKED_BPT_WSTETH));
    ethPrice = uint256(AggregatorInterface(ETH_USD_PRICE_FEED).latestAnswer());
  }

  /// @inheritdoc IStakedTokenDataProvider
  function getStkAaveData() external view override returns (StakedTokenData memory stkAaveData) {
    console.log('get DATA', STAKED_AAVE);
    stkAaveData = _getStakedTokenData(AggregatedStakedAaveV3(STAKED_AAVE));

    // console.log('bar DATA', stkAaveData);
  }

  /// @inheritdoc IStakedTokenDataProvider
  function getStkBptData() external view override returns (StakedTokenData memory stkBptData) {
    stkBptData = _getStakedTokenData(AggregatedStakedAaveV3(STAKED_BPT));
  }

  function getStakedAssetData(address stakedAsset)
    external
    view
    override
    returns (StakedTokenData memory)
  {
    return _getStakedTokenData(AggregatedStakedAaveV3(stakedAsset));
  }

  /// @inheritdoc IStakedTokenDataProvider
  function getAllStakedTokenUserData(address user)
    external
    view
    override
    returns (
      StakedTokenData memory stkAaveData,
      StakedTokenUserData memory stkAaveUserData,
      StakedTokenData memory stkBptData,
      StakedTokenUserData memory stkBptUserData,
      StakedTokenData memory stkBptWstETHData,
      StakedTokenUserData memory stkBptWstETHUserData,
      uint256 ethPrice
    )
  {
    stkAaveData = _getStakedTokenData(AggregatedStakedAaveV3(STAKED_AAVE));
    stkAaveUserData = _getStakedTokenUserData(AggregatedStakedAaveV3(STAKED_AAVE), user);
    stkBptData = _getStakedTokenData(AggregatedStakedAaveV3(STAKED_BPT));
    stkBptUserData = _getStakedTokenUserData(AggregatedStakedAaveV3(STAKED_BPT), user);

    stkBptWstETHData = _getStakedTokenData(AggregatedStakedAaveV3(STAKED_BPT_WSTETH));
    stkBptWstETHUserData = _getStakedTokenUserData(AggregatedStakedAaveV3(STAKED_BPT_WSTETH), user);

    ethPrice = uint256(AggregatorInterface(ETH_USD_PRICE_FEED).latestAnswer());
  }

  /// @inheritdoc IStakedTokenDataProvider
  function getStkAaveUserData(address user)
    external
    view
    override
    returns (StakedTokenData memory stkAaveData, StakedTokenUserData memory stkAaveUserData)
  {
    stkAaveData = _getStakedTokenData(AggregatedStakedAaveV3(STAKED_AAVE));
    stkAaveUserData = _getStakedTokenUserData(AggregatedStakedAaveV3(STAKED_AAVE), user);
  }

  /// @inheritdoc IStakedTokenDataProvider
  function getStkBptAaveUserData(address user)
    external
    view
    override
    returns (StakedTokenData memory stkBptData, StakedTokenUserData memory stkBptUserData)
  {
    stkBptData = _getStakedTokenData(AggregatedStakedAaveV3(STAKED_BPT));
    stkBptUserData = _getStakedTokenUserData(AggregatedStakedAaveV3(STAKED_BPT), user);
  }

  /// @inheritdoc IStakedTokenDataProvider
  function getStkBptWstETHUserData(address user)
    external
    view
    override
    returns (
      StakedTokenData memory stkBptWstETHData,
      StakedTokenUserData memory stkBptWstETHUserData
    )
  {
    stkBptWstETHData = _getStakedTokenData(AggregatedStakedAaveV3(STAKED_BPT_WSTETH));
    stkBptWstETHUserData = _getStakedTokenUserData(AggregatedStakedAaveV3(STAKED_BPT_WSTETH), user);
  }

  function getStakedUserData(address user, address stakedAsset)
    external
    view
    override
    returns (StakedTokenData memory, StakedTokenUserData memory)
  {
    return (
      _getStakedTokenData(AggregatedStakedAaveV3(stakedAsset)),
      _getStakedTokenUserData(AggregatedStakedAaveV3(stakedAsset), user)
    );
  }

  /**
   * @notice Returns data of the Staked Token passed as parameter
   * @param stakedToken The address of the StakedToken (eg. stkAave, stkBptAave)
   * @return data An object with general data of the StakedToken
   */
  function _getStakedTokenData(AggregatedStakedAaveV3 stakedToken)
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

      // stkBptAave
    } else if (address(stakedToken) == STAKED_BPT) {
      data.stakedTokenPriceEth = uint256(AggregatorInterface(BPT_PRICE_FEED).latestAnswer());
      data.stakeApy = _calculateApy(
        data.distributionPerSecond * data.rewardTokenPriceEth,
        data.stakedTokenTotalSupply * data.stakedTokenPriceEth
      );
    } else if (address(stakedToken) == STAKED_BPT_WSTETH) {
      // stkBptWstETH
      data.stakedTokenPriceEth = uint256(AggregatorInterface(BPT_STETH_PRICE_FEED).latestAnswer());
      data.stakeApy = _calculateApy(
        data.distributionPerSecond * data.rewardTokenPriceEth,
        data.stakedTokenTotalSupply * data.stakedTokenPriceEth
      );
    }
  }

  function foo() public view returns (string memory) {
    return 'bar';
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
