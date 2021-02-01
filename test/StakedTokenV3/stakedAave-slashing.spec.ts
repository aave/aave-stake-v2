import { makeSuite, TestEnv } from '../helpers/make-suite';
import { COOLDOWN_SECONDS, UNSTAKE_WINDOW, MAX_UINT_AMOUNT, WAD } from '../../helpers/constants';
import { waitForTx, timeLatest, advanceBlock, increaseTimeAndMine } from '../../helpers/misc-utils';
import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import { getContract, getEthersSigners } from '../../helpers/contracts-helpers';
import { deployStakedAaveV3, getStakedAaveProxy } from '../../helpers/contracts-accessors';
import { StakedTokenV3 } from '../../types/StakedTokenV3';
import { StakedAaveV3 } from '../../types/StakedAaveV3';
import { getUserIndex } from '../DistributionManager/data-helpers/asset-user-data';
import { getRewards } from '../DistributionManager/data-helpers/base-math';
import { compareRewardsAtAction } from '../StakedAaveV2/data-helpers/reward';

const { expect } = require('chai');

const SLASHING_ADMIN = 0;
const COOLDOWN_ADMIN = 1;

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

    await aaveToken.connect(rewardsVault).approve(stakeV3.address, MAX_UINT_AMOUNT);

    //initialize the stake instance

    await stakeV3['initialize(address,address,uint256)'](
      users[0].address,
      users[1].address,
      '2000'
    );

    const slashingAdmin = await stakeV3.getAdmin(SLASHING_ADMIN); //slash admin
    const cooldownAdmin = await stakeV3.getAdmin(COOLDOWN_ADMIN); //cooldown admin

    expect(slashingAdmin).to.be.equal(users[0].address);
    expect(cooldownAdmin).to.be.equal(users[1].address);
  });

  it('Reverts trying to stake 0 amount', async () => {
    const {
      users: [, staker],
    } = testEnv;
    const amount = '0';

    await expect(stakeV3.connect(staker.signer).stake(staker.address, amount)).to.be.revertedWith(
      'INVALID_ZERO_AMOUNT'
    );
  });

  it('User 1 stakes 10 AAVE: receives 10 stkAAVE, StakedAave balance of AAVE is 10 and his rewards to claim are 0', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;
    const amount = ethers.utils.parseEther('10');

    const saveBalanceBefore = new BigNumber((await stakeV3.balanceOf(staker.address)).toString());

    // Prepare actions for the test case
    const actions = () => [
      aaveToken.connect(staker.signer).approve(stakeV3.address, amount),
      stakeV3.connect(staker.signer).stake(staker.address, amount),
    ];

    // Check rewards
    await compareRewardsAtAction(stakeV3, staker.address, actions);

    // Stake token tests
    expect((await stakeV3.balanceOf(staker.address)).toString()).to.be.equal(
      saveBalanceBefore.plus(amount.toString()).toString()
    );
    expect((await aaveToken.balanceOf(stakeV3.address)).toString()).to.be.equal(
      saveBalanceBefore.plus(amount.toString()).toString()
    );
    expect((await stakeV3.balanceOf(staker.address)).toString()).to.be.equal(amount);
    expect((await aaveToken.balanceOf(stakeV3.address)).toString()).to.be.equal(amount);
  });

  it('User 1 stakes 10 AAVE more: his total SAAVE balance increases, StakedAave balance of Aave increases and his reward until now get accumulated', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;
    const amount = ethers.utils.parseEther('10');

    const saveBalanceBefore = new BigNumber((await stakeV3.balanceOf(staker.address)).toString());
    const actions = () => [
      aaveToken.connect(staker.signer).approve(stakeV3.address, amount),
      stakeV3.connect(staker.signer).stake(staker.address, amount),
    ];

    // Checks rewards
    await compareRewardsAtAction(stakeV3, staker.address, actions, true);

    // Extra test checks
    expect((await stakeV3.balanceOf(staker.address)).toString()).to.be.equal(
      saveBalanceBefore.plus(amount.toString()).toString()
    );
    expect((await aaveToken.balanceOf(stakeV3.address)).toString()).to.be.equal(
      saveBalanceBefore.plus(amount.toString()).toString()
    );
  });

  it('User 1 claim half rewards', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;
    // Increase time for bigger rewards
    await increaseTimeAndMine(1000);

    const halfRewards = (await stakeV3.stakerRewardsToClaim(staker.address)).div(2);
    const saveUserBalance = await aaveToken.balanceOf(staker.address);

    await stakeV3.connect(staker.signer).claimRewards(staker.address, halfRewards);

    const userBalanceAfterActions = await aaveToken.balanceOf(staker.address);
    expect(userBalanceAfterActions.eq(saveUserBalance.add(halfRewards))).to.be.ok;
  });

  it('User 1 tries to claim higher reward than current rewards balance', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;

    const saveUserBalance = await aaveToken.balanceOf(staker.address);

    // Try to claim more amount than accumulated
    await expect(
      stakeV3.connect(staker.signer).claimRewards(staker.address, ethers.utils.parseEther('10000'))
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
      exchangeRateBeforeRedeem.times(amountToRedeem).div(10 ** 18)
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

    const userBalanceAfterStake = new BigNumber(
      (await stakeV3.balanceOf(staker.address)).toString()
    );
    const exchangeRateAfterStake = new BigNumber((await stakeV3.exchangeRate()).toString());

    const expectedUserBalanceAfterStake = userBalanceBeforeStake.plus(
      amountToStake
        .times(10 ** 18)
        .div(exchangeRateBeforeStake)
        .toFixed(0)
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

  it('Tries to change the slash admin not being the slash admin', async () => {
    const { users } = testEnv;

    await expect(stakeV3.setPendingAdmin(SLASHING_ADMIN, users[2].address)).to.be.revertedWith(
      'CALLER_NOT_ROLE_ADMIN'
    );
  });

  it('Tries to change the cooldown admin not being the cooldown admin', async () => {
    const { users } = testEnv;

    await expect(
      stakeV3.connect(users[3].signer).setPendingAdmin(COOLDOWN_ADMIN, users[3].address)
    ).to.be.revertedWith('CALLER_NOT_ROLE_ADMIN');
  });

  it('Changes the pending slashing admin', async () => {
    const { users } = testEnv;

    await stakeV3.connect(users[0].signer).setPendingAdmin(SLASHING_ADMIN, users[3].address);

    const newPendingAdmin = await stakeV3.getPendingAdmin(SLASHING_ADMIN);

    expect(newPendingAdmin).to.be.equal(users[3].address);
  });

  it('Tries to claim the pending slashing admin not being the pending admin', async () => {
    const { users } = testEnv;

    await expect(
      stakeV3.connect(users[0].signer).claimRoleAdmin(SLASHING_ADMIN)
    ).to.be.revertedWith('CALLER_NOT_PENDING_ROLE_ADMIN');
  });

  it('Claim the slashing admin role', async () => {
    const { users } = testEnv;

    await stakeV3.connect(users[3].signer).claimRoleAdmin(SLASHING_ADMIN);

    const newAdmin = await stakeV3.getAdmin(SLASHING_ADMIN);

    expect(newAdmin).to.be.equal(users[3].address);
  });

  it('Changes the cooldown pending admin', async () => {
    const { users } = testEnv;

    await stakeV3.connect(users[1].signer).setPendingAdmin(COOLDOWN_ADMIN, users[3].address);

    const newPendingAdmin = await stakeV3.getPendingAdmin(COOLDOWN_ADMIN);

    expect(newPendingAdmin).to.be.equal(users[3].address);
  });

  it('Tries to claim the pending cooldown admin not being the pending admin', async () => {
    const { users } = testEnv;

    await expect(
      stakeV3.connect(users[0].signer).claimRoleAdmin(COOLDOWN_ADMIN)
    ).to.be.revertedWith('CALLER_NOT_PENDING_ROLE_ADMIN');
  });

  it('Claim the cooldown admin role', async () => {
    const { users } = testEnv;

    await stakeV3.connect(users[3].signer).claimRoleAdmin(COOLDOWN_ADMIN);

    const newAdmin = await stakeV3.getAdmin(COOLDOWN_ADMIN);

    expect(newAdmin).to.be.equal(users[3].address);
  });


  it('Pauses the cooldown', async () => {
    const { users } = testEnv;

    await stakeV3.connect(users[3].signer).setCooldownPause(true);

    const cooldownPaused = await stakeV3.getCooldownPaused();

    expect(cooldownPaused).to.be.equal(true);
  });

  it('Checks that users cannot redeem even during the unstake window', async () => {
    const {
      users: [, staker],
    } = testEnv;

    //activates cooldown
    await stakeV3.connect(staker.signer).cooldown();

    //moves forward to enter the unstake window
    const cooldownActivationTimestamp = await timeLatest();

    await advanceBlock(
      cooldownActivationTimestamp.plus(new BigNumber(COOLDOWN_SECONDS).plus(1000)).toNumber()
    );

    await expect(stakeV3.redeem(staker.address, '1000')).to.be.revertedWith(
      'INSUFFICIENT_COOLDOWN'
    );
  });

  it('Checks that initialize cannot be called', async () => {
    const {
      users: [, staker],
    } = testEnv;

    await expect(stakeV3['initialize()']()).to.be.revertedWith('DEPRECATED');
  });

  it('Sets the slashing percentage to 30%', async () => {
    const { users } = testEnv;

    await stakeV3.connect(users[3].signer).setMaxSlashablePercentage('3000');

    const currentSlashingPercentage = await stakeV3.getMaxSlashablePercentage();

    expect(currentSlashingPercentage.toString()).to.be.equal('3000');
  });

  it('Sets an invalid slashing percentage', async () => {
    const { users } = testEnv;

    await expect(
      stakeV3.connect(users[3].signer).setMaxSlashablePercentage('20000')
    ).to.be.revertedWith('INVALID_SLASHING_PERCENTAGE');
  });

  it('Tried to slash for a percentage bigger than the max percentage', async () => {
    const { aaveToken, users } = testEnv;

    const fundsReceiver = users[3].address;

    const userBalanceBeforeSlash = new BigNumber(
      (await aaveToken.balanceOf(fundsReceiver)).toString()
    );

    const currentStakeBalance = new BigNumber(
      (await aaveToken.balanceOf(stakeV3.address)).toString()
    );

    const amountToSlash = currentStakeBalance.times(0.4).toFixed(0);

    await expect(
      stakeV3.connect(users[3].signer).slash(fundsReceiver, amountToSlash)
    ).to.be.revertedWith('INVALID_SLASHING_AMOUNT');
  });

  it('Reverts trying to redeem 0 amount', async () => {
    const {
      users: [, staker],
    } = testEnv;

    const amount = '0';

    await expect(stakeV3.connect(staker.signer).redeem(staker.address, amount)).to.be.revertedWith(
      'INVALID_ZERO_AMOUNT'
    );
  });
});
