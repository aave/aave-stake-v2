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
    bool inPostSlashingPeriod;
    uint256 distributionEnd;
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
   * @notice Returns data of Staked assets
   * @param stakedAsset The address of the stakedAsset
   * @param oracleAddress The address of the oracle denominated in 18 decimals
   * @return stakedAssetData An object with staked asset data
   */
  function getStakedAssetData(address stakedAsset, address oracleAddress)
    external
    view
    returns (StakedTokenData memory stakedAssetData);

  /**
   * @notice Retrieves staked token data and user-specific data for a given user, staked asset, and its associated oracle.
   * @param user The address of the user for whom the data is to be fetched.
   * @param stakedAsset The address representing the staked token.
   * @param oracleAddress The address representing the oracle associated with the staked token denominated in 18 decimals.
   * @return stakedTokenData `StakedTokenData` struct with details about the staked asset.
   * @return stakedUserData `StakedTokenUserData` struct containing user-specific details related to the staked asset.
   */
  function getStakedUserData(
    address user,
    address stakedAsset,
    address oracleAddress
  )
    external
    view
    returns (StakedTokenData memory stakedTokenData, StakedTokenUserData memory stakedUserData);

  /**
   * @notice Retrieves data for a batch of staked assets given their addresses and the addresses of their associated oracles.
   * @param stakedTokens An array of addresses representing the staked tokens.
   * @param oracleAddresses An array of addresses representing the oracles associated with the staked tokens denominated as 18 decimals.
   * @return stakedData An array containing data about the staked assets.
   * @return prices An array containing the latest price data from the oracles for the staked tokens.
   * @return ethPrice A uint256 with the latest ETH price for the staked tokens.
   */
  function getStakedAssetDataBatch(
    address[] calldata stakedTokens,
    address[] calldata oracleAddresses
  )
    external
    view
    returns (
      StakedTokenData[] memory stakedData,
      uint256[] memory prices,
      uint256 ethPrice
    );

  /**
   * @notice Retrieves data for a batch of staked users and their assets given the addresses of staked tokens, associated oracles, and users.
   * @param stakedTokens An array of addresses representing the staked tokens.
   * @param oracleAddresses An array of addresses representing the oracles associated with the staked tokens denominated as 18 decimals.
   * @param userAddress An addresses representing the user whose data should be retrieved.
   * @return stakedTokenData An array containing data about the staked assets.
   * @return stakedUserData An array containing user-specific data about the staked assets.
   */
  function getStakedUserDataBatch(
    address[] calldata stakedTokens,
    address[] calldata oracleAddresses,
    address userAddress
  )
    external
    view
    returns (StakedTokenData[] memory stakedTokenData, StakedTokenUserData[] memory stakedUserData);
}
