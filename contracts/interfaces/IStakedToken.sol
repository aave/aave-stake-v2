// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

interface IStakedToken {
  struct AssetData {
    uint128 emissionPerSecond;
    uint128 lastUpdateTimestamp;
    uint256 index;
  }

  function totalSupply() external view returns (uint256);

  function COOLDOWN_SECONDS() external view returns (uint256);

  function UNSTAKE_WINDOW() external view returns (uint256);

  function DISTRIBUTION_END() external view returns (uint256);

  function assets(address asset) external view returns (AssetData memory);

  function balanceOf(address user) external view returns (uint256);

  function getTotalRewardsBalance(address user) external view returns (uint256);

  function stakersCooldowns(address user) external view returns (uint256);

  /**
   * @dev Executes a slashing of the underlying of a certain amount, transferring the seized funds
   * to destination. Decreasing the amount of underlying will automatically adjust the exchange rate.
   * A call to `slash` will start a slashing event which has to be settled via `settleSlashing`.
   * As long as the slashing event is ongoing, stake and slash are deactivated.
   * - MUST NOT be called when a previous slashing is still ongoing
   * @param destination the address where seized funds will be transferred
   * @param amount the amount to be slashed
   * - if the amount bigger than maximum allowed, the maximum will be slashed instead.
   * @return amount the amount slashed
   */
  function slash(address destination, uint256 amount) external returns (uint256);

  /**
   * @dev returns the exact amount of assets that would be redeemed for the provided number of shares
   * @param shares the number of shares to redeem
   * @return uint256 assets the number of assets that would be redeemed
   */
  function previewRedeem(uint256 shares) external view returns (uint256);
}
