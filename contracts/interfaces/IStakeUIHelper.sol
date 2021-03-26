// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

interface IStakeUIHelper {
  struct AssetUIData {
    uint256 stakeTokenTotalSupply;
    uint256 stakeCooldownSeconds;
    uint256 stakeUnstakeWindow;
    uint256 stakeTokenPriceEth;
    uint256 rewardTokenPriceEth;
    uint256 stakeApy;
    uint128 distributionPerSecond;
    uint256 distributionEnd;
    uint256 stakeTokenUserBalance;
    uint256 underlyingTokenUserBalance;
    uint256 userCooldown;
    uint256 userIncentivesToClaim;
    uint256 userPermitNonce;
  }

  function getStkAaveData(address user) external view returns (AssetUIData memory);

  function getStkBptData(address user) external view returns (AssetUIData memory);

  function getUserUIData(address user)
    external
    view
    returns (
      AssetUIData memory,
      AssetUIData memory,
      uint256
    );
}
