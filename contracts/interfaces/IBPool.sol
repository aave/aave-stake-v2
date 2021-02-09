pragma solidity ^0.7.5;
pragma abicoder v2;

interface IBPool {
  //additions from dhadrien
  function finalize() external; // added by dhadrien

  function joinPool(uint256, uint256[] calldata) external;

  function swapExactAmountIn(
    address tokenIn,
    uint256 tokenAmountIn,
    address tokenOut,
    uint256 minAmountOut,
    uint256 maxPrice
  ) external returns (uint256 tokenAmountOut, uint256 spotPriceAfter);

  function rebind(
    address token,
    uint256 balance,
    uint256 denorm
  ) external;

  function setSwapFee(uint256 swapFee) external;

  function setPublicSwap(bool publicSwap) external;

  function bind(
    address token,
    uint256 balance,
    uint256 denorm
  ) external;

  function unbind(address token) external;

  function gulp(address token) external;

  function isBound(address token) external view returns (bool);

  function getBalance(address token) external view returns (uint256);

  function totalSupply() external view returns (uint256);

  function getSwapFee() external view returns (uint256);

  function isPublicSwap() external view returns (bool);

  function getDenormalizedWeight(address token) external view returns (uint256);

  function getTotalDenormalizedWeight() external view returns (uint256);

  // solhint-disable-next-line func-name-mixedcase
  function EXIT_FEE() external view returns (uint256);

  function calcPoolOutGivenSingleIn(
    uint256 tokenBalanceIn,
    uint256 tokenWeightIn,
    uint256 poolSupply,
    uint256 totalWeight,
    uint256 tokenAmountIn,
    uint256 swapFee
  ) external pure returns (uint256 poolAmountOut);

  function calcSingleInGivenPoolOut(
    uint256 tokenBalanceIn,
    uint256 tokenWeightIn,
    uint256 poolSupply,
    uint256 totalWeight,
    uint256 poolAmountOut,
    uint256 swapFee
  ) external pure returns (uint256 tokenAmountIn);

  function calcSingleOutGivenPoolIn(
    uint256 tokenBalanceOut,
    uint256 tokenWeightOut,
    uint256 poolSupply,
    uint256 totalWeight,
    uint256 poolAmountIn,
    uint256 swapFee
  ) external pure returns (uint256 tokenAmountOut);

  function calcPoolInGivenSingleOut(
    uint256 tokenBalanceOut,
    uint256 tokenWeightOut,
    uint256 poolSupply,
    uint256 totalWeight,
    uint256 tokenAmountOut,
    uint256 swapFee
  ) external pure returns (uint256 poolAmountIn);

  function getCurrentTokens() external view returns (address[] memory tokens);
}
