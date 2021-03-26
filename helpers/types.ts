import BigNumber from 'bignumber.js';

export enum eContractid {
  DistributionManager = 'DistributionManager',
  StakedAave = 'StakedAave',
  StakedAaveImpl = 'StakedAaveImpl',
  AaveIncentivesController = 'AaveIncentivesController',
  IERC20Detailed = 'IERC20Detailed',
  AdminUpgradeabilityProxy = 'AdminUpgradeabilityProxy',
  InitializableAdminUpgradeabilityProxy = 'InitializableAdminUpgradeabilityProxy',
  MintableErc20 = 'MintableErc20',
  LendingPoolMock = 'LendingPoolMock',
  MockTransferHook = 'MockTransferHook',
  ATokenMock = 'ATokenMock',
  StakedAaveV2 = 'StakedAaveV2',
  DoubleTransferHelper = 'DoubleTransferHelper',
  StakedAaveV3 = 'StakedAaveV3',
  ICRPFactory = 'ICRPFactory',
  StakedTokenV2 = 'StakedTokenV2',
  StakedTokenV3 = 'StakedTokenV3',
  IConfigurableRightsPool = 'IConfigurableRightsPool',
  IBPool = 'IBPool',
  IControllerAaveEcosystemReserve = 'IControllerAaveEcosystemReserve',
  MockSelfDestruct = 'SelfdestructTransfer',
  AaveEcosystemReserve = 'AaveEcosystemReserve',
}

export interface SymbolMap<T> {
  [symbol: string]: T;
}

export type eNetwork = eEthereumNetwork | ePolygonNetwork | eXDaiNetwork;

export enum eEthereumNetwork {
  kovan = 'kovan',
  ropsten = 'ropsten',
  main = 'main',
  coverage = 'coverage',
  hardhat = 'hardhat',
}

export enum ePolygonNetwork {
  matic = 'matic',
  mumbai = 'mumbai',
}

export enum eXDaiNetwork {
  xdai = 'xdai',
}

export enum EthereumNetworkNames {
  kovan = 'kovan',
  ropsten = 'ropsten',
  hardhat = 'hardhat',
  main = 'main',
  matic = 'matic',
  mumbai = 'mumbai',
  xdai = 'xdai',
}

export type tEthereumAddress = string;
export type tStringTokenBigUnits = string; // 1 ETH, or 10e6 USDC or 10e18 DAI
export type tBigNumberTokenBigUnits = BigNumber;
export type tStringTokenSmallUnits = string; // 1 wei, or 1 basic unit of USDC, or 1 basic unit of DAI
export type tBigNumberTokenSmallUnits = BigNumber;
export interface IReserveCollateralParams {
  baseLTVAsCollateral: string;
  liquidationThreshold: string;
  liquidationBonus: string;
}
export interface IMarketRates {
  borrowRate: string;
}

export type iParamsPerNetwork<T> =
  | iEthereumParamsPerNetwork<T>
  | iPolygonParamsPerNetwork<T>
  | iXDaiParamsPerNetwork<T>;

export interface iParamsPerNetworkAll<T>
  extends iEthereumParamsPerNetwork<T>,
    iPolygonParamsPerNetwork<T>,
    iXDaiParamsPerNetwork<T> {}

export interface iEthereumParamsPerNetwork<T> {
  [eEthereumNetwork.coverage]: T;
  [eEthereumNetwork.kovan]: T;
  [eEthereumNetwork.ropsten]: T;
  [eEthereumNetwork.main]: T;
  [eEthereumNetwork.hardhat]: T;
}

export interface iPolygonParamsPerNetwork<T> {
  [ePolygonNetwork.matic]: T;
  [ePolygonNetwork.mumbai]: T;
}

export interface iXDaiParamsPerNetwork<T> {
  [eXDaiNetwork.xdai]: T;
}

export enum RateMode {
  None = '0',
  Stable = '1',
  Variable = '2',
}

export interface ObjectString {
  [key: string]: string;
}
