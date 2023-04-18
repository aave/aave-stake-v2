// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

interface StakeUIHelperIV2 {
  struct StakedTokenData {
    uint256 stakeTokenTotalSupply;
    uint256 stakeCooldownSeconds;
    uint256 stakeUnstakeWindow;
    uint256 stakeTokenPriceEth;
    uint256 rewardTokenPriceEth;
    uint256 stakeApy;
    uint128 distributionPerSecond;
    uint256 distributionEnd;
  }

  struct StakedTokenUserData {
    uint256 stakeTokenUserBalance;
    uint256 underlyingTokenUserBalance;
    uint40 userCooldownTimestamp;
    uint216 userCooldownAmount;
  }

  /**
   * @notice Returns data of all Staked Tokens
   * @return stkAaveData An object with StkAave data
   * @return stkBptData An object with StkBpt data
   * @return ethPrice The price of ETH, USD denominated (expressed with 8 decimals)
   */
  function getAllStakedTokenData()
    external
    view
    returns (
      StakedTokenData memory stkAaveData,
      StakedTokenData memory stkBptData,
      uint256 ethPrice
    );

  /**
   * @notice Returns data of Staked Aave
   * @return An object with StkAave data
   */
  function getStkAaveData() external view override returns (StakedTokenData memory stkAaveData);

  /**
   * @notice Returns data of Staked Bpt Aave
   * @return An object with StkBpt data
   */
  function getStkBptData() external view override returns (StakedTokenData memory stkBptData);

  /**
   * @notice Returns user data of all Staked Tokens
   * @param user The address of the user
   * @return stkAaveData An object with StkAave data
   * @return stkAaveUserData An object with user data of StkAave
   * @return stkBptData An object with StkBpt data
   * @return stkBptUserData An object with user data of StkBpt
   * @return ethPrice The price of ETH, USD denominated (expressed with 8 decimals)
   */
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
    override
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
    override
    returns (StakedTokenData memory stkBptData, StakedTokenUserData memory stkBptUserData);
}
