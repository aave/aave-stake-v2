import { makeSuite, TestEnv } from '../helpers/make-suite';
import {
  COOLDOWN_SECONDS,
  UNSTAKE_WINDOW,
  MAX_UINT_AMOUNT,
  STAKED_AAVE_NAME,
  STAKED_AAVE_SYMBOL,
  STAKED_AAVE_DECIMALS,
} from '../../helpers/constants';
import { waitForTx, timeLatest, advanceBlock, increaseTimeAndMine } from '../../helpers/misc-utils';
import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import { compareRewardsAtAction } from './data-helpers/reward';
import { getUserIndex } from '../DistributionManager/data-helpers/asset-user-data';
import { getRewards } from '../DistributionManager/data-helpers/base-math';
import { logAaveTokenBalanceOf } from './data-helpers/loggers';

const { expect } = require('chai');

makeSuite('StakedAave V2. Basics', (testEnv: TestEnv) => {
  it('Initial configuration after initialize() is correct', async () => {
    const { stakedAaveV2, aaveToken, rewardsVault } = testEnv;

    expect(await stakedAaveV2.name()).to.be.equal(STAKED_AAVE_NAME);
    expect(await stakedAaveV2.symbol()).to.be.equal(STAKED_AAVE_SYMBOL);
    expect(await stakedAaveV2.decimals()).to.be.equal(STAKED_AAVE_DECIMALS);
    expect(await stakedAaveV2.REVISION()).to.be.equal(2);
    expect(await stakedAaveV2.STAKED_TOKEN()).to.be.equal(aaveToken.address);
    expect(await stakedAaveV2.REWARD_TOKEN()).to.be.equal(aaveToken.address);
    expect((await stakedAaveV2.COOLDOWN_SECONDS()).toString()).to.be.equal(COOLDOWN_SECONDS);
    expect((await stakedAaveV2.UNSTAKE_WINDOW()).toString()).to.be.equal(UNSTAKE_WINDOW);
    expect(await stakedAaveV2.REWARDS_VAULT()).to.be.equal(rewardsVault.address);
  });

  it('Reverts trying to stake 0 amount', async () => {
    const {
      stakedAaveV2,
      users: [, staker],
    } = testEnv;
    const amount = '0';

    await expect(
      stakedAaveV2.connect(staker.signer).stake(staker.address, amount)
    ).to.be.revertedWith('INVALID_ZERO_AMOUNT');
  });

  it('Reverts trying to activate cooldown with 0 staked amount', async () => {
    const {
      stakedAaveV2,
      users: [, staker],
    } = testEnv;
    const amount = '0';

    await expect(stakedAaveV2.connect(staker.signer).cooldown()).to.be.revertedWith(
      'INVALID_BALANCE_ON_COOLDOWN'
    );
  });

  it('User 1 stakes 50 AAVE: receives 50 SAAVE, StakedAave balance of AAVE is 50 and his rewards to claim are 0', async () => {
    const {
      stakedAaveV2,
      aaveToken,
      users: [, staker],
    } = testEnv;
    const amount = ethers.utils.parseEther('50');

    const saveBalanceBefore = new BigNumber(
      (await stakedAaveV2.balanceOf(staker.address)).toString()
    );

    // Prepare actions for the test case
    const actions = () => [
      aaveToken.connect(staker.signer).approve(stakedAaveV2.address, amount),
      stakedAaveV2.connect(staker.signer).stake(staker.address, amount),
    ];

    // Check rewards
    await compareRewardsAtAction(stakedAaveV2, staker.address, actions);

    // Stake token tests
    expect((await stakedAaveV2.balanceOf(staker.address)).toString()).to.be.equal(
      saveBalanceBefore.plus(amount.toString()).toString()
    );
    expect((await aaveToken.balanceOf(stakedAaveV2.address)).toString()).to.be.equal(
      saveBalanceBefore.plus(amount.toString()).toString()
    );
    expect((await stakedAaveV2.balanceOf(staker.address)).toString()).to.be.equal(amount);
    expect((await aaveToken.balanceOf(stakedAaveV2.address)).toString()).to.be.equal(amount);
  });

  it('User 1 stakes 20 AAVE more: his total SAAVE balance increases, StakedAave balance of Aave increases and his reward until now get accumulated', async () => {
    const {
      stakedAaveV2,
      aaveToken,
      users: [, staker],
    } = testEnv;
    const amount = ethers.utils.parseEther('20');

    const saveBalanceBefore = new BigNumber(
      (await stakedAaveV2.balanceOf(staker.address)).toString()
    );
    const actions = () => [
      aaveToken.connect(staker.signer).approve(stakedAaveV2.address, amount),
      stakedAaveV2.connect(staker.signer).stake(staker.address, amount),
    ];

    // Checks rewards
    await compareRewardsAtAction(stakedAaveV2, staker.address, actions, true);

    // Extra test checks
    expect((await stakedAaveV2.balanceOf(staker.address)).toString()).to.be.equal(
      saveBalanceBefore.plus(amount.toString()).toString()
    );
    expect((await aaveToken.balanceOf(stakedAaveV2.address)).toString()).to.be.equal(
      saveBalanceBefore.plus(amount.toString()).toString()
    );
  });

  it('User 1 claim half rewards ', async () => {
    const {
      stakedAaveV2,
      aaveToken,
      users: [, staker],
    } = testEnv;
    // Increase time for bigger rewards
    await increaseTimeAndMine(1000);

    const halfRewards = (await stakedAaveV2.stakerRewardsToClaim(staker.address)).div(2);
    const saveUserBalance = await aaveToken.balanceOf(staker.address);

    await stakedAaveV2.connect(staker.signer).claimRewards(staker.address, halfRewards);

    const userBalanceAfterActions = await aaveToken.balanceOf(staker.address);
    expect(userBalanceAfterActions.eq(saveUserBalance.add(halfRewards))).to.be.ok;
  });

  it('User 1 tries to claim higher reward than current rewards balance', async () => {
    const {
      stakedAaveV2,
      aaveToken,
      users: [, staker],
    } = testEnv;

    const saveUserBalance = await aaveToken.balanceOf(staker.address);

    // Try to claim more amount than accumulated
    await expect(
      stakedAaveV2
        .connect(staker.signer)
        .claimRewards(staker.address, ethers.utils.parseEther('10000'))
    ).to.be.revertedWith('INVALID_AMOUNT');

    const userBalanceAfterActions = await aaveToken.balanceOf(staker.address);
    expect(userBalanceAfterActions.eq(saveUserBalance)).to.be.ok;
  });

  it('User 1 claim all rewards', async () => {
    const {
      stakedAaveV2,
      aaveToken,
      users: [, staker],
    } = testEnv;

    const userAddress = staker.address;
    const underlyingAsset = stakedAaveV2.address;

    const userBalance = await stakedAaveV2.balanceOf(userAddress);
    const userAaveBalance = await aaveToken.balanceOf(userAddress);
    const userRewards = await stakedAaveV2.stakerRewardsToClaim(userAddress);
    // Get index before actions
    const userIndexBefore = await getUserIndex(stakedAaveV2, userAddress, underlyingAsset);

    // Claim rewards
    await expect(stakedAaveV2.connect(staker.signer).claimRewards(staker.address, MAX_UINT_AMOUNT));

    // Get index after actions
    const userIndexAfter = await getUserIndex(stakedAaveV2, userAddress, underlyingAsset);

    const expectedAccruedRewards = getRewards(
      userBalance,
      userIndexAfter,
      userIndexBefore
    ).toString();
    const userAaveBalanceAfterAction = (await aaveToken.balanceOf(userAddress)).toString();

    expect(userAaveBalanceAfterAction).to.be.equal(
      userAaveBalance.add(userRewards).add(expectedAccruedRewards).toString()
    );
  });

  it('User 6 stakes 50 AAVE, with the rewards not enabled', async () => {
    const { stakedAaveV2, aaveToken, users } = testEnv;
    const amount = ethers.utils.parseEther('50');
    const sixStaker = users[5];

    // Disable rewards via config
    const assetsConfig = {
      emissionPerSecond: '0',
      totalStaked: '0',
    };

    // Checks rewards
    const actions = () => [
      aaveToken.connect(sixStaker.signer).approve(stakedAaveV2.address, amount),
      stakedAaveV2.connect(sixStaker.signer).stake(sixStaker.address, amount),
    ];

    await compareRewardsAtAction(stakedAaveV2, sixStaker.address, actions, false, assetsConfig);

    // Check expected stake balance for six staker
    expect((await stakedAaveV2.balanceOf(sixStaker.address)).toString()).to.be.equal(
      amount.toString()
    );

    // Expect rewards balance to still be zero
    const rewardsBalance = await (
      await stakedAaveV2.getTotalRewardsBalance(sixStaker.address)
    ).toString();
    expect(rewardsBalance).to.be.equal('0');
  });

  it('User 6 stakes 30 AAVE more, with the rewards not enabled', async () => {
    const { stakedAaveV2, aaveToken, users } = testEnv;
    const amount = ethers.utils.parseEther('30');
    const staker = users[1];
    const sixStaker = users[5];
    const saveBalanceBefore = new BigNumber(
      (await stakedAaveV2.balanceOf(sixStaker.address)).toString()
    );
    // Keep rewards disabled via config
    const assetsConfig = {
      emissionPerSecond: '0',
      totalStaked: '0',
    };

    // Checks rewards
    const actions = () => [
      aaveToken.connect(sixStaker.signer).approve(stakedAaveV2.address, amount),
      stakedAaveV2.connect(sixStaker.signer).stake(sixStaker.address, amount),
    ];

    await compareRewardsAtAction(stakedAaveV2, sixStaker.address, actions, false, assetsConfig);

    // Expect rewards balance to still be zero
    const rewardsBalance = await (
      await stakedAaveV2.getTotalRewardsBalance(sixStaker.address)
    ).toString();
    expect(rewardsBalance).to.be.equal('0');
  });

  it('Validates staker cooldown with stake() while being on valid unstake window', async () => {
    const { stakedAaveV2, aaveToken, users } = testEnv;
    const amount1 = ethers.utils.parseEther('50');
    const amount2 = ethers.utils.parseEther('20');
    const staker = users[4];

    // Checks rewards
    const actions = () => [
      aaveToken.connect(staker.signer).approve(stakedAaveV2.address, amount1.add(amount2)),
      stakedAaveV2.connect(staker.signer).stake(staker.address, amount1),
    ];

    await compareRewardsAtAction(stakedAaveV2, staker.address, actions, false);

    await stakedAaveV2.connect(staker.signer).cooldown();

    const cooldownActivationTimestamp = await timeLatest();

    await advanceBlock(
      cooldownActivationTimestamp.plus(new BigNumber(COOLDOWN_SECONDS).plus(1000)).toNumber()
    ); // We fast-forward time to just after the unstake window

    const stakerCooldownTimestampBefore = new BigNumber(
      (await stakedAaveV2.stakersCooldowns(staker.address)).toString()
    );
    await waitForTx(await stakedAaveV2.connect(staker.signer).stake(staker.address, amount2));
    const latestTimestamp = await timeLatest();
    const expectedCooldownTimestamp = amount2
      .mul(latestTimestamp.toString())
      .add(amount1.mul(stakerCooldownTimestampBefore.toString()))
      .div(amount2.add(amount1));
    expect(expectedCooldownTimestamp.toString()).to.be.equal(
      (await stakedAaveV2.stakersCooldowns(staker.address)).toString()
    );
  });
});
