// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import {PartialIStakedAaveV3} from '../interfaces/PartialIStakedAaveV3.sol';
import {IPriceOracle} from '../interfaces/IPriceOracle.sol';
import {AggregatorInterface} from '../interfaces/AggregatorInterface.sol';
import {StakeUIHelperIV2} from '../interfaces/StakeUIHelperIV2.sol';
import {IERC20} from '../interfaces/IERC20.sol';

contract StakeUIHelperV2 is StakeUIHelperIV2 {
  IPriceOracle public immutable PRICE_ORACLE;
  AggregatorInterface public immutable BPT_PRICE_FEED;

  address public immutable AAVE;
  PartialIStakedAaveV3 public immutable STAKED_AAVE;

  address public immutable BPT;
  PartialIStakedAaveV3 public immutable STAKED_BPT;

  address public constant WETH = 0xCCa7d1416518D095E729904aAeA087dBA749A4dC; // TODO ETH

  uint256 private constant SECONDS_PER_YEAR = 365 days;
  uint256 private constant APY_PRECISION = 10000; // PercentageMath

  /**
   * @dev Constructor
   * @param aave The address of the AAVE token
   * @param stkAave The address of the StkAAVE token
   * @param bpt The address of the BPT AAVE / ETH token
   * @param stkBpt The address of the StkBptAAVE token
   * @param priceOracle The address of the Price Oracle
   * @param bptPriceFeed The address of StakedBpt price feed (TODO decimals?)
   */
  constructor(
    address aave,
    IStakedToken stkAave,
    address bpt,
    IStakedToken stkBpt,
    IPriceOracle priceOracle,
    AggregatorInterface bptPriceFeed
  ) public {
    AAVE = aave;
    STAKED_AAVE = stkAave;
    BPT = bpt;
    STAKED_BPT = stkBpt;
    PRICE_ORACLE = priceOracle; // USD PRICE FEED, 8 decimals
    BPT_PRICE_FEED = AggregatorInterface(bptPriceFeed); // TODO CHECK CL FEED DECIMALS
  }

  /// @inheritdoc StakeUIHelperIV2
  function getAllStakedTokenData()
    external
    view
    override
    returns (
      StakedTokenData memory stkAaveData,
      StakedTokenData memory stkBptData,
      uint256 ethPrice
    )
  {
    stkAaveData = _getStakedTokenData(STAKED_AAVE);
    stkBptData = _getStakedTokenData(STAKED_BPT);
    ethPrice = PRICE_ORACLE.getAssetPrice(WETH);
  }

  /// @inheritdoc StakeUIHelperIV2
  function getStkAaveData() external view override returns (StakedTokenData memory stkAaveData) {
    stkAaveData = _getStakedTokenData(STAKED_AAVE);
  }

  /// @inheritdoc StakeUIHelperIV2
  function getStkBptData() external view override returns (StakedTokenData memory stkBptData) {
    stkBptData = _getStakedTokenData(STAKED_BPT);
  }

  /// @inheritdoc StakeUIHelperIV2
  function getAllStakedTokenUserData(address user)
    external
    view
    override
    returns (
      StakedTokenData memory stkAaveData,
      StakedTokenUserData memory stkAaveUserData,
      StakedTokenData memory stkBptData,
      StakedTokenUserData memory stkBptUserData,
      uint256 ethPrice
    )
  {
    stkAaveData = _getStakedTokenData(STAKED_AAVE);
    stkAaveUserData = _getStakedTokenUserData(STAKED_AAVE);
    stkBptData = _getStakedTokenData(STAKED_BPT);
    stkBptUserData = _getStakedTokenUserData(STAKED_BPT);
    ethPrice = PRICE_ORACLE.getAssetPrice(WETH);
  }

  /// @inheritdoc StakeUIHelperIV2
  function getStkAaveUserData(address user)
    external
    view
    override
    returns (StakedTokenData memory stkAaveData, StakedTokenUserData memory stkAaveUserData)
  {
    stkAaveData = _getStakedTokenData(STAKED_AAVE);
    stkAaveUserData = _getStakedTokenUserData(STAKED_AAVE, user);
  }

  /// @inheritdoc StakeUIHelperIV2
  function getStkBptAaveUserData(address user)
    external
    view
    override
    returns (StakedTokenData memory stkBptData, StakedTokenUserData memory stkBptUserData)
  {
    stkBptData = _getStakedTokenData(STAKED_BPT);
    stkBptUserData = _getStakedTokenUserData(STAKED_BPT, user);
  }

  /**
   * @notice Returns data of the Staked Token passed as parameter
   * @param stakedToken The address of the StakedToken (eg. stkAave, stkBptAave)
   * @return An object with general data of the StakedToken
   */
  function _getStakedTokenData(IStakedToken stakedToken)
    internal
    view
    returns (GeneralStakeUIData memory data)
  {
    data.stakedTokenTotalSupply = stakedToken.totalSupply();
    data.stakeCooldownSeconds = stakedToken.COOLDOWN_SECONDS();
    data.stakeUnstakeWindow = stakedToken.UNSTAKE_WINDOW();
    data.rewardTokenPriceEth = PRICE_ORACLE.getAssetPrice(AAVE);
    data.distributionEnd = stakedToken.DISTRIBUTION_END();

    data.distributionPerSecond = block.timestamp < data.distributionEnd
      ? stakedToken.assets(address(stakedToken)).emissionPerSecond
      : 0;

    // stkAave
    if (stakedToken == STAKED_AAVE) {
      data.stakedTokenPriceEth = data.rewardTokenPriceEth;
      // assumes AAVE and stkAAVE have the same value
      data.stakeApy = _calculateApy(data.distributionPerSecond, data.stakedTokenTotalSupply);

      // stkBptAave
    } else if (stakedToken == STAKED_BPT) {
      data.stakedTokenPriceEth = BPT_PRICE_FEED.latestAnswer();
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
  function _getStakedTokenUserData(IStakedToken stakedToken, address user)
    internal
    view
    returns (StakeTokenUserData memory data)
  {
    data.stakedTokenUserBalance = stakedToken.balanceOf(user);
    data.userIncentivesToClaim = stakedToken.getTotalRewardsBalance(user); // TODO Check
    // stkAave
    if (stakedToken == STAKED_AAVE) {
      data.underlyingTokenUserBalance = stakedToken.previewRedeem(
        IERC20(stakedToken.STAKED_TOKEN()).balanceOf(user)
      );
      (data.userCooldownTimestamp, data.userCooldownAmount) = stakedToken.stakersCooldowns(user);
      // stkBptAave
    } else if (stakedToken == STAKED_BPT) {
      data.underlyingTokenUserBalance = IERC20(stakedToken.STAKED_TOKEN()).balanceOf(user);
      data.userCooldownAmount = uint216(stakedToken.stakersCooldowns(user));
    }
  }
}
