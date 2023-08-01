// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

/**
 * @title IStakedTokenDataProvider
 * @notice It defines the basic interface of the Staked Token Data Provider
 */
interface IStakedTokenDataProvider {
  struct StakedTokenData {
    uint256 stakedTokenTotalSupply;
    uint256 stakedTokenTotalRedeemableAmount;
    uint256 stakeCooldownSeconds;
    uint256 stakeUnstakeWindow;
    uint256 stakedTokenPriceEth;
    uint256 rewardTokenPriceEth;
    uint256 stakeApy;
    uint128 distributionPerSecond;
    uint256 distributionEnd;
    bool inPostSlashingPeriod;
  }

  struct StakedTokenUserData {
    uint256 stakedTokenUserBalance;
    uint256 stakedTokenRedeemableAmount;
    uint256 underlyingTokenUserBalance;
    uint256 rewardsToClaim;
    uint40 userCooldownTimestamp;
    uint216 userCooldownAmount;
  }

  /**
   * @notice Return the address of the ETH price feed, USD denominated
   * @return The address of the ETH price feed, USD denominated, expressed with 8 decimals
   */
  function ETH_USD_PRICE_FEED() external returns (address);

  /**
   * @notice Return the address of the AAVE price feed, ETH denominated
   * @return The address of the AAVE price feed, ETH denominated, expressed with 18 decimals
   */
  function AAVE_PRICE_FEED() external returns (address);

  /**
   * @notice Return the address of the BPT price feed, ETH denominated
   * @return The address of the BPT price feed, ETH denominated, expressed with 18 decimals
   */
  function BPT_PRICE_FEED() external returns (address);

  /**
   * @notice Return the address of the BPT price feed, ETH denominated
   * @return The address of the BPT price feed, ETH denominated, expressed with 18 decimals
   */
  function BPT_STETH_PRICE_FEED() external returns (address);

  /**
   * @notice Return the address of the AAVE token
   * @return The address of the AAVE token
   */
  function AAVE() external returns (address);

  /**
   * @notice Return the address of the Staked AAVE token
   * @return The address of the StkAAVE token
   */
  function STAKED_AAVE() external returns (address);

  /**
   * @notice Return the address of the BPT token
   * @return The address of the BPT token
   */
  function BPT() external returns (address);

  /**
   * @notice Return the address of the Staked BPT token
   * @return The address of the StkBPT token
   */
  function STAKED_BPT() external returns (address);

  // fooo

  /**
   * @notice Return the address of the stETH token
   * @return The address of the stETH token
   */
  function STAKED_BPT_WSTETH() external returns (address);

  // /**
  //  * @notice Return the address of the Staked ETH token
  //  * @return The address of the StkBPT token
  //  */
  // function STAKED_STETH() external returns (address);

  /**
   * @notice Returns data of all Staked Tokens
   * @return stkAaveData An object with StkAave data
   * @return stkBptData An object with StkBpt data
   * @return stkBptWstETH An object with stkBptWstETH data
   * @return ethPrice The price of ETH, USD denominated (expressed with 8 decimals)
   */
  function getAllStakedTokenData()
    external
    view
    returns (
      StakedTokenData memory stkAaveData,
      StakedTokenData memory stkBptData,
      StakedTokenData memory stkBptWstETH,
      uint256 ethPrice
    );

  /**
   * @notice Returns data of Staked Aave
   * @return stkAaveData An object with StkAave data
   */
  function getStkAaveData() external view returns (StakedTokenData memory stkAaveData);

  /**
   * @notice Returns data of Staked Bpt Aave
   * @return stkBptData An object with StkBpt data
   */
  function getStkBptData() external view returns (StakedTokenData memory stkBptData);

  /**
   * @notice Returns data of Staked Bpt Aave
   * @return stkBptWstETHData An object with StkBpt data
   */
  function getStkBptWstETHData() external view returns (StakedTokenData memory stkBptWstETHData);

  /**
   * @notice Returns user data of all Staked Tokens
   * @param user The address of the user
   * @return stkAaveData An object with StkAave data
   * @return stkAaveUserData An object with user data of StkAave
   * @return stkBptData An object with StkBpt data
   * @return stkBptUserData An object with user data of StkBpt
   * @return stkBptWstETHData An object with stkBptWstETHData data
   * @return stkBptWstETHUserData An object with user data of StkBpt
   * @return ethPrice The price of ETH, USD denominated (expressed with 8 decimals)
   */
  function getAllStakedTokenUserData(address user)
    external
    view
    returns (
      StakedTokenData memory stkAaveData,
      StakedTokenUserData memory stkAaveUserData,
      StakedTokenData memory stkBptData,
      StakedTokenUserData memory stkBptUserData,
      StakedTokenData memory stkBptWstETHData,
      StakedTokenUserData memory stkBptWstETHUserData,
      uint256 ethPrice
    );

  /**
   * @notice Returns user data of Staked Aave
   * @param user The address of the user
   * @return stkAaveData An object with StkAave data
   * @return stkAaveUserData An object with user data of StkAave
   */
  function getStkAaveUserData(address user)
    external
    view
    returns (StakedTokenData memory stkAaveData, StakedTokenUserData memory stkAaveUserData);

  /**
   * @notice Returns user data of Staked Bpt Aave
   * @param user The address of the user
   * @return stkBptData An object with StkBpt data
   * @return stkBptUserData An object with user data of StkBpt
   */
  function getStkBptAaveUserData(address user)
    external
    view
    returns (StakedTokenData memory stkBptData, StakedTokenUserData memory stkBptUserData);

  /**
   * @notice Returns user data of Staked Bpt Aave
   * @param user The address of the user
   * @return stkBptWstETHData An object with StkBpt data
   * @return stkBptWstETHUserData An object with user data of StkBpt
   */
  function getStkBptWstETHUserData(address user)
    external
    view
    returns (
      StakedTokenData memory stkBptWstETHData,
      StakedTokenUserData memory stkBptWstETHUserData
    );
}
