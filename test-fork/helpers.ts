import { tEthereumAddress } from '../helpers/types';
import {
  AaveProtocolDataProvider__factory,
  Erc20__factory,
  ILendingPoolAddressesProvider__factory,
} from '../types';
import { expect } from 'chai';
import { parseUnits } from 'ethers/lib/utils';
import { MAX_UINT_AMOUNT } from '../helpers/constants';
import { DRE } from '../helpers/misc-utils';
import { ILendingPool } from '../types/ILendingPool';
import { Signer } from 'ethers';

export const spendList: {
  [key: string]: { holder: string; transfer: string; deposit: string; decimals: string };
} = {
  DAI: {
    holder: '0x72aabd13090af25dbb804f84de6280c697ed1150',
    transfer: '1000',
    deposit: '100',
    decimals: '18',
  },
  GUSD: {
    holder: '0x3e6722f32cbe5b3c7bd3dca7017c7ffe1b9e5a2a',
    transfer: '1000',
    deposit: '100',
    decimals: '2',
  },
  USDC: {
    holder: '0xAe2D4617c862309A3d75A0fFB358c7a5009c673F',
    transfer: '1000',
    deposit: '100',
    decimals: '6',
  },
  USDT: {
    holder: '0x9f57dc21f521c64204b6190c3076a05b559b1a28',
    transfer: '1000',
    deposit: '100',
    decimals: '6',
  },
  WBTC: {
    holder: '0x6dab3bcbfb336b29d06b9c793aef7eaa57888922',
    transfer: '1',
    deposit: '0.5',
    decimals: '8',
  },
  WETH: {
    holder: '0x0f4ee9631f4be0a63756515141281a3e2b293bbe',
    transfer: '1',
    deposit: '0.5',
    decimals: '18',
  },
};

export const getReserveConfigs = async (
  poolProviderAddress: tEthereumAddress,
  reserves: string,
  proposer: Signer
) => {
  const poolProvider = await ILendingPoolAddressesProvider__factory.connect(
    poolProviderAddress,
    proposer
  );
  const protocolDataProvider = await AaveProtocolDataProvider__factory.connect(
    await poolProvider.getAddress(
      '0x0100000000000000000000000000000000000000000000000000000000000000'
    ),
    proposer
  );

  const reservesConfigs = (await protocolDataProvider.getAllReservesTokens())
    .filter(({ symbol }) => reserves.includes(symbol))
    .sort(({ symbol: a }, { symbol: b }) => a.localeCompare(b));

  expect(reservesConfigs.length).to.be.eq(6);
  return reservesConfigs;
};

export const fullCycleLendingPool = async (
  symbol: string,
  tokenAddress: string,
  proposer: Signer,
  pool: ILendingPool
) => {
  const { aTokenAddress, variableDebtTokenAddress } = await pool.getReserveData(tokenAddress);
  const reserve = Erc20__factory.connect(tokenAddress, proposer);
  const aToken = Erc20__factory.connect(aTokenAddress, proposer);
  const holderSigner = DRE.ethers.provider.getSigner(spendList[symbol].holder);
  const proposerAddress = await proposer.getAddress();
  // Transfer assets to proposer from reserve holder
  await (
    await reserve
      .connect(holderSigner)
      .transfer(proposerAddress, parseUnits(spendList[symbol].transfer, spendList[symbol].decimals))
  ).wait();

  // Amounts
  const depositAmount = parseUnits(spendList[symbol].deposit, spendList[symbol].decimals);
  const borrowAmount = depositAmount.div('10');

  // Deposit to LendingPool
  await (await reserve.connect(proposer).approve(pool.address, depositAmount)).wait();
  const tx1 = await pool
    .connect(proposer)
    .deposit(reserve.address, depositAmount, proposerAddress, 0);
  await tx1.wait();
  expect(tx1).to.emit(pool, 'Deposit');

  // Request loan to LendingPool
  const tx2 = await pool.borrow(reserve.address, borrowAmount, '2', '0', proposerAddress);
  await tx2.wait();
  expect(tx2).to.emit(pool, 'Borrow');

  // Repay variable loan to LendingPool
  await (await reserve.connect(proposer).approve(pool.address, MAX_UINT_AMOUNT)).wait();
  const tx3 = await pool.repay(reserve.address, MAX_UINT_AMOUNT, '2', proposerAddress);
  await tx3.wait();
  expect(tx3).to.emit(pool, 'Repay');

  // Withdraw from LendingPool
  const priorBalance = await reserve.balanceOf(proposerAddress);
  await (await aToken.connect(proposer).approve(pool.address, MAX_UINT_AMOUNT)).wait();
  const tx4 = await pool.withdraw(reserve.address, MAX_UINT_AMOUNT, proposerAddress);
  await tx4.wait();
  expect(tx4).to.emit(pool, 'Withdraw');

  const afterBalance = await reserve.balanceOf(proposerAddress);
  expect(await aToken.balanceOf(proposerAddress)).to.be.eq('0');
  expect(afterBalance).to.be.gt(priorBalance);
};
