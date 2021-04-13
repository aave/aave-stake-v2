import { expect } from 'chai';
import { AaveIncentivesController } from '../../../types/AaveIncentivesController';
import { AaveIncentivesController__factory } from '../../../types/factories/AaveIncentivesController__factory';
import { ILendingPool } from '../../../types/ILendingPool';
import { ILendingPool__factory } from '../../../types/factories/ILendingPool__factory';
import hre, { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { tEthereumAddress } from '../../../helpers/types';
import { Contract } from '@ethersproject/contracts';
import deployedAssets from '../../../asset-addresses.json';
import { MintableErc20 } from '../../../types/MintableErc20';
import { MintableErc20__factory } from '../../../types/factories/MintableErc20__factory';
import { parseEther } from '@ethersproject/units';
import {
  impersonateAccountsHardhat,
  increaseTime,
  setDRE,
  waitForTx,
} from '../../../helpers/misc-utils';
import { deploySelfDestruct } from '../../../helpers/contracts-accessors';
import { Signer } from '@ethersproject/abstract-signer';
import { BigNumber } from '@ethersproject/bignumber';
import { promises } from 'fs';
import { MAX_UINT_AMOUNT } from '../../../helpers/constants';

const WMATIC_DATA = deployedAssets.matic.assets.find(({ symbol }) => symbol == 'WMATIC');
const WMATIC = WMATIC_DATA?.address || '';
const REWARD_ADMIN_ROLE = 4;

type token = {
  name: string;
  asset: MintableErc20;
  aToken: MintableErc20;
  debtToken: MintableErc20;
  holder: Signer;
};

describe('AaveIncentivesController configuration test', () => {
  let incentiveController: AaveIncentivesController;
  let pool: ILendingPool;
  let wmaticERC20: MintableErc20;
  let user: SignerWithAddress;
  let EMISSION_MANAGER: tEthereumAddress;
  let REWARD_TOKEN: tEthereumAddress;
  let REWARDS_VAULT: tEthereumAddress;
  let REWARDS_ADMIN: tEthereumAddress;
  let emissionManagerSigner: Signer;
  let rewardsVaultSigner: Signer;
  let tokens: token[] = [];

  before(async () => {
    setDRE(hre);
    user = (await ethers.getSigners())[0];
    incentiveController = AaveIncentivesController__factory.connect(
      deployedAssets.matic.incentivesController,
      user
    );
    pool = ILendingPool__factory.connect(deployedAssets.matic.lendingPool, user);
    wmaticERC20 = MintableErc20__factory.connect(WMATIC, user);
    for (const asset of deployedAssets.matic.assets) {
      const token = MintableErc20__factory.connect(asset.address, user);
      let holder = {} as Signer;
      const filter = token.filters.Transfer(null, null, null);
      const transfers = await token.queryFilter(
        filter,
        Number(process.env.FORKING_BLOCK) - 1000,
        Number(process.env.FORKING_BLOCK)
      );
      for (let i = 0; i < transfers.length; i++) {
        const log = transfers[i];
        const to = log.args?.to;
        const tokenBalance = await token.balanceOf(to);
        const ethBalance = await hre.ethers.provider.getBalance(to);
        const minBalance =
          asset.symbol == 'WMATIC'
            ? parseEther('1000')
            : BigNumber.from(10)
                .pow(await token.decimals())
                .div(1000);
        if (tokenBalance.gt(minBalance) && ethBalance.gt(parseEther('0.3'))) {
          await impersonateAccountsHardhat([to]);
          holder = hre.ethers.provider.getSigner(to);
          break;
        }
      }
      tokens.push({
        name: asset.symbol,
        asset: token.connect(holder),
        aToken: MintableErc20__factory.connect(asset.aTokenAddress, holder),
        debtToken: MintableErc20__factory.connect(asset.variableDebtTokenAddress, holder),
        holder: holder,
      });
    }
    tokens.map(async (token) => {
      console.log(token.name);
      console.log('atoken', token.aToken.address);
      console.log('asset', token.asset.address);
      console.log('debt', token.debtToken.address);
      console.log('holder', await token.holder.getAddress());
    });
    EMISSION_MANAGER = await incentiveController.EMISSION_MANAGER();
    console.log('EMISSION MANAGER: ', EMISSION_MANAGER);

    REWARD_TOKEN = await incentiveController.REWARD_TOKEN();
    expect(REWARD_TOKEN).to.be.equal(WMATIC, 'REWARD TOKEN NOT WMATIC');

    REWARDS_VAULT = await incentiveController.getRewardsVault();
    console.log('REWARDS_VAULT: ', REWARDS_VAULT);

    const miniWmatic = new Contract(WMATIC, ['function deposit() payable'], user);
    await (await miniWmatic.deposit({ value: parseEther('20') })).wait();

    REWARDS_ADMIN = await incentiveController.getAdmin(REWARD_ADMIN_ROLE);
    console.log('REWARDS_ADMIN', REWARDS_ADMIN);

    await impersonateAccountsHardhat([REWARDS_ADMIN, REWARDS_VAULT, EMISSION_MANAGER]);

    let SelfDestructContract = await deploySelfDestruct();
    await waitForTx(
      await SelfDestructContract.destroyAndTransfer(REWARDS_VAULT, { value: parseEther('10') })
    );
    SelfDestructContract = await deploySelfDestruct();
    await waitForTx(
      await SelfDestructContract.destroyAndTransfer(EMISSION_MANAGER, { value: parseEther('10') })
    );

    emissionManagerSigner = hre.ethers.provider.getSigner(EMISSION_MANAGER);
    rewardsVaultSigner = hre.ethers.provider.getSigner(REWARDS_VAULT);

    console.log('Setup ok ');
  });
  it('add wmatic to the vault', async () => {
    const wmatic = tokens.find(({ name }) => name === 'WMATIC') as token;
    await wmatic.asset.connect(wmatic.holder).transfer(REWARDS_VAULT, parseEther('9'));
  });
  it('vault approve incentives controller', async () => {
    await wmaticERC20
      .connect(rewardsVaultSigner)
      .approve(incentiveController.address, parseEther('1000'));
    console.log((await wmaticERC20.balanceOf(REWARDS_VAULT)).toString());
  });
  it('configure Assets', async () => {
    await hre.run('configure-asset', {
      testedNetwork: 'matic',
      testedAdmin: EMISSION_MANAGER,
      execute: true,
    });
  });
  it('deposit', async () => {
    for (const token of tokens) {
      const holderAddress = await token.holder.getAddress();
      const aTokenBalanceBefore = await token.aToken.balanceOf(holderAddress);
      const balanceBefore = await token.asset.balanceOf(holderAddress);
      await token.asset.approve(pool.address, 100000);
      await (
        await pool.connect(token.holder).deposit(token.asset.address, 1000, holderAddress, 0)
      ).wait();
      const aTokenBalanceAfter = await token.aToken.balanceOf(holderAddress);
      const balanceAfter = await token.asset.balanceOf(holderAddress);
      expect(aTokenBalanceAfter).to.be.equal(aTokenBalanceBefore.add(1000));
      expect(balanceBefore).to.be.equal(balanceAfter.add(1000));
    }
  });
  it('withdraw', async () => {
    for (const token of tokens) {
      const holderAddress = await token.holder.getAddress();
      const aTokenBalanceBefore = await token.aToken.balanceOf(holderAddress);
      const balanceBefore = await token.asset.balanceOf(holderAddress);
      await token.asset.approve(pool.address, 100000);
      await (
        await pool.connect(token.holder).withdraw(token.asset.address, 500, holderAddress)
      ).wait();
      const aTokenBalanceAfter = await token.aToken.balanceOf(holderAddress);
      const balanceAfter = await token.asset.balanceOf(holderAddress);
      expect(balanceBefore).to.be.equal(balanceAfter.sub(500));
    }
  });
  it('borrow', async () => {
    const wmatic = tokens.find(({ name }) => name == 'WMATIC') as token;
    const wmaticHolderAddress = await wmatic.holder.getAddress();
    await wmatic.asset.connect(wmatic.holder).approve(pool.address, MAX_UINT_AMOUNT);
    await pool
      .connect(wmatic.holder)
      .deposit(
        wmatic.asset.address,
        await wmaticERC20.balanceOf(wmaticHolderAddress),
        wmaticHolderAddress,
        0
      );
    for (const token of tokens.filter(({ name }) => name != 'AAVE')) {
      const holderAddress = await token.holder.getAddress();
      console.log(token.name);
      const balanceBefore = await token.asset.balanceOf(wmaticHolderAddress);
      await (
        await pool
          .connect(wmatic.holder)
          .borrow(token.asset.address, 100, 2, 0, wmaticHolderAddress)
      ).wait();
      const balanceAfter = await token.asset.balanceOf(wmaticHolderAddress);
      expect(balanceBefore).to.be.equal(balanceAfter.sub(100));
    }
  });
  it('get Rewards', async () => {
    await increaseTime(360000);
    for (const token of tokens) {
      const holderAddress = await token.holder.getAddress();

      const wmatic = tokens.find(({ name }) => name == 'WMATIC') as token;
      const wmaticBalanceBefore = await wmatic.asset.connect(token.holder).balanceOf(holderAddress);
      await incentiveController
        .connect(token.holder)
        .claimRewards([token.aToken.address], MAX_UINT_AMOUNT, holderAddress, false);
      const wmaticBalanceAfter = await wmatic.asset.connect(token.holder).balanceOf(holderAddress);
      console.log(wmaticBalanceBefore.toString());
      console.log(wmaticBalanceAfter.toString());
      // expect(wmaticBalanceAfter.toNumber()).to.be.greaterThan(wmaticBalanceBefore.toNumber());
      // wmatic holder is the one that has borrowed
      if (token.name == 'WMATIC') {
        const wmaticBalanceBefore = await wmatic.asset
          .connect(token.holder)
          .balanceOf(holderAddress);
        await incentiveController.connect(token.holder).claimRewards(
          tokens.filter(({ name }) => name != 'AAVE').map((token) => token.debtToken.address),
          MAX_UINT_AMOUNT,
          holderAddress,
          false
        );
        const wmaticBalanceAfter = await wmatic.asset
          .connect(token.holder)
          .balanceOf(holderAddress);
        console.log(wmaticBalanceBefore.toString());
        console.log(wmaticBalanceAfter.toString());
        // expect(wmaticBalanceAfter.toNumber()).to.be.greaterThan(wmaticBalanceBefore.toNumber());
      }
    }
  });
});
