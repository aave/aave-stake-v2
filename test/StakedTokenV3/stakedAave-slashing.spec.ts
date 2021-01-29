import { makeSuite, TestEnv } from '../helpers/make-suite';
import {
  COOLDOWN_SECONDS,
  UNSTAKE_WINDOW,
  MAX_UINT_AMOUNT,
  STAKED_AAVE_NAME,
  STAKED_AAVE_SYMBOL,
  STAKED_AAVE_DECIMALS,
  WAD,
} from '../../helpers/constants';
import { waitForTx, timeLatest, advanceBlock, increaseTimeAndMine } from '../../helpers/misc-utils';
import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import { InitializableAdminUpgradeabilityProxy } from '../../types/InitializableAdminUpgradeabilityProxy';
import { eContractid } from '../../helpers/types';
import { getContract, getEthersSigners } from '../../helpers/contracts-helpers';
import { deployStakedAaveV3, getStakedAaveProxy } from '../../helpers/contracts-accessors';
import { StakedTokenV3 } from '../../types/StakedTokenV3';
import { StakedAaveV3 } from '../../types/StakedAaveV3';

const { expect } = require('chai');

makeSuite('StakedAave V3 slashing tests', (testEnv: TestEnv) => {
  let stakeV3: StakedAaveV3;

  it('Deploys StakedAaveV3', async () => {
    const { aaveToken, users } = testEnv;

    const [deployer, rewardsVault] = await getEthersSigners();

    const rewardsVaultAddress = (await rewardsVault.getAddress()).toString();
    const emissionManager = await deployer.getAddress();

    stakeV3 = await deployStakedAaveV3([
      aaveToken.address,
      aaveToken.address,
      COOLDOWN_SECONDS,
      UNSTAKE_WINDOW,
      rewardsVaultAddress,
      emissionManager,
      (1000 * 60 * 60).toString(),
    ]);

    //initialize the stake instance

    await stakeV3.initialize(users[0].address, users[1].address);
  });

  it('Verifies that the initial exchange rate is 1:1', async () => {
    const currentExchangeRate = await stakeV3.exchangeRate();

    expect(currentExchangeRate.toString()).to.be.equal(WAD);
  });

  it('Verifies that after a deposit the initial exchange rate is still 1:1', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;
    const amount = ethers.utils.parseEther('50');

    await aaveToken.connect(staker.signer).approve(stakeV3.address, amount);
    await stakeV3.connect(staker.signer).stake(staker.address, amount);

    const currentExchangeRate = await stakeV3.exchangeRate();

    expect(currentExchangeRate.toString()).to.be.equal(WAD);
  });

  it('Sets the slashing percentage to 30%', async () => {
    const { aaveToken, users } = testEnv;

    await stakeV3.connect(users[0].signer).setMaxSlashablePercentage('3000');

    const currentSlashingPercentage = await stakeV3.getMaxSlashablePercentage();

    expect(currentSlashingPercentage.toString()).to.be.equal('3000');
  });

  it('Executes a slash of 20% of the asset', async () => {
    const { aaveToken, users } = testEnv;

    const fundsReceiver = users[3].address;

    const userBalanceBeforeSlash = new BigNumber(
      (await aaveToken.balanceOf(fundsReceiver)).toString()
    );

    const currentStakeBalance = new BigNumber(
      (await aaveToken.balanceOf(stakeV3.address)).toString()
    );

    const amountToSlash = currentStakeBalance.times(0.2).toFixed(0);

    await stakeV3.connect(users[0].signer).slash(fundsReceiver, amountToSlash);

    const newStakeBalance = new BigNumber((await aaveToken.balanceOf(stakeV3.address)).toString());

    const userBalanceAfterSlash = new BigNumber(
      (await aaveToken.balanceOf(fundsReceiver)).toString()
    );

    const exchangeRate = new BigNumber((await stakeV3.exchangeRate()).toString()).toString();

    expect(newStakeBalance.toString()).to.be.equal(
      currentStakeBalance.minus(amountToSlash).toFixed(0)
    );
    expect(userBalanceAfterSlash.toString()).to.be.equal(
      userBalanceBeforeSlash.plus(amountToSlash).toFixed(0)
    );
    expect(exchangeRate).to.be.equal(ethers.utils.parseEther('0.8'));
  });

  it('Redeems 1 stkAAVE after slashing - expected to receive 0.8 AAVE', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;

    const userBalanceBeforeRedeem = new BigNumber(
      (await aaveToken.balanceOf(staker.address)).toString()
    );
    const exchangeRateBeforeRedeem = new BigNumber((await stakeV3.exchangeRate()).toString());

    const amountToRedeem = ethers.utils.parseEther('1').toString();

    //activates cooldown
    await stakeV3.connect(staker.signer).cooldown();

    //moves forward to enter the unstake window
    const cooldownActivationTimestamp = await timeLatest();

    await advanceBlock(
      cooldownActivationTimestamp.plus(new BigNumber(COOLDOWN_SECONDS).plus(1000)).toNumber()
    );
    //redeem
    await stakeV3.connect(staker.signer).redeem(staker.address, amountToRedeem);

    const userBalanceAfterRedeem = new BigNumber(
      (await aaveToken.balanceOf(staker.address)).toString()
    );
    const exchangeRateAfterRedeem = new BigNumber((await stakeV3.exchangeRate()).toString());

    const expectedUserBalanceAfterRedeem = userBalanceBeforeRedeem.plus(
      exchangeRateBeforeRedeem
        .times(amountToRedeem).div(10 ** 18)
    );

    expect(userBalanceAfterRedeem.toString()).to.be.equal(
      expectedUserBalanceAfterRedeem.toString(),
      'Invalid user balance after redeem'
    );

    expect(exchangeRateAfterRedeem.toString()).to.be.equal(
      exchangeRateBeforeRedeem.toString(),
      'Invalid exchange rate after redeem'
    );
  });


  it('Stakes 1 AAVE more - expected to receive 1.25 stkAAVE', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;

    const userBalanceBeforeStake = new BigNumber(
      (await stakeV3.balanceOf(staker.address)).toString()
    );
    const exchangeRateBeforeStake = new BigNumber((await stakeV3.exchangeRate()).toString());

    const amountToStake = new BigNumber(ethers.utils.parseEther('1').toString());

    //stake
    await aaveToken.connect(staker.signer).approve(stakeV3.address, amountToStake.toString());
    await stakeV3.connect(staker.signer).stake(staker.address, amountToStake.toString());

    const userBalanceAfterStake= new BigNumber(
      (await stakeV3.balanceOf(staker.address)).toString()
    );
    const exchangeRateAfterStake = new BigNumber((await stakeV3.exchangeRate()).toString());

    const expectedUserBalanceAfterStake = userBalanceBeforeStake.plus(
      amountToStake.times(10 ** 18).div(exchangeRateBeforeStake).toFixed(0)
    );

    expect(userBalanceAfterStake.toString()).to.be.equal(
      expectedUserBalanceAfterStake.toString(),
      'Invalid user balance after stake'
    );

    expect(exchangeRateAfterStake.toString()).to.be.equal(
      exchangeRateBeforeStake.toString(),
      'Invalid exchange rate after stake'
    );
  });

  it('Tries to slash with an account that is not the slashing admin', async () => {
    const { users } = testEnv;

    await expect(stakeV3.slash(users[2].address, '1')).to.be.revertedWith(
      'CALLER_NOT_SLASHING_ADMIN'
    );
  });

  it('Tries to pause the cooldown with an account that is not the cooldown admin', async () => {
    const { users } = testEnv;

    await expect(stakeV3.connect(users[3].signer).setCooldownPause(true)).to.be.revertedWith(
      'CALLER_NOT_COOLDOWN_ADMIN'
    );
  });
});
