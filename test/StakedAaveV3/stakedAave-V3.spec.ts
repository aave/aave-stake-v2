import { makeSuite, TestEnv } from '../helpers/make-suite';
import { COOLDOWN_SECONDS, UNSTAKE_WINDOW, MAX_UINT_AMOUNT, WAD } from '../../helpers/constants';
import {
  waitForTx,
  timeLatest,
  advanceBlock,
  increaseTimeAndMine,
  DRE,
  evmRevert,
  evmSnapshot,
  increaseTime,
  setBlocktime,
} from '../../helpers/misc-utils';
import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import {
  buildPermitParams,
  getBlockTimestamp,
  getEthersSigners,
  getSignatureFromTypedData,
} from '../../helpers/contracts-helpers';
import { deployStakedAaveV3 } from '../../helpers/contracts-accessors';
import { StakedAaveV3 } from '../../types/StakedAaveV3';
import { getUserIndex } from '../DistributionManager/data-helpers/asset-user-data';
import { getRewards } from '../DistributionManager/data-helpers/base-math';
import { compareRewardsAtAction } from '../StakedAaveV2/data-helpers/reward';
import { fail } from 'assert';
import { parseEther } from 'ethers/lib/utils';
import { expect } from 'chai';

const SLASHING_ADMIN = 0;
const COOLDOWN_ADMIN = 1;
const CLAIM_HELPER_ROLE = 2;

makeSuite('StakedAave V3 slashing tests', (testEnv: TestEnv) => {
  let stakeV3: StakedAaveV3;
  let snap: string;

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
      (10000 * 60 * 60).toString(),
    ]);

    await aaveToken.connect(rewardsVault).approve(stakeV3.address, MAX_UINT_AMOUNT);

    //initialize the stake instance

    await waitForTx(
      await stakeV3['initialize(address,address,address,uint256)'](
        users[0].address,
        users[1].address,
        users[2].address,
        '2000'
      )
    );

    const slashingAdmin = await stakeV3.getAdmin(SLASHING_ADMIN); //slash admin
    const cooldownAdmin = await stakeV3.getAdmin(COOLDOWN_ADMIN); //cooldown admin
    const claimAdmin = await stakeV3.getAdmin(CLAIM_HELPER_ROLE); //claim admin // helper contract

    expect(slashingAdmin).to.be.equal(users[0].address);
    expect(cooldownAdmin).to.be.equal(users[1].address);
    expect(claimAdmin).to.be.equal(users[2].address);
  });

  it('Reverts trying to stake 0 amount', async () => {
    const {
      users: [, staker],
    } = testEnv;
    const amount = '0';

    const action = stakeV3.connect(staker.signer).stake(staker.address, amount);
    await expect(action).be.revertedWith('INVALID_ZERO_AMOUNT');
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
    await increaseTime(64000);
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

    const halfRewards = (await stakeV3.getTotalRewardsBalance(staker.address)).div(2);
    const saveUserBalance = await aaveToken.balanceOf(staker.address);

    await stakeV3.connect(staker.signer).claimRewards(staker.address, halfRewards);

    const userBalanceAfterActions = await aaveToken.balanceOf(staker.address);
    expect(userBalanceAfterActions).eq(saveUserBalance.add(halfRewards));
  });

  it('User 1 tries to claim higher reward than current rewards balance', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;

    const time = await timeLatest();

    await setBlocktime(time.toNumber() + 1);

    const userBalanceBefore = await aaveToken.balanceOf(staker.address, { blockTag: 'pending' });
    const rewards = await stakeV3.getTotalRewardsBalance(staker.address, { blockTag: 'pending' });

    // Try to claim more amount than accumulated
    await waitForTx(
      await stakeV3
        .connect(staker.signer)
        .claimRewards(staker.address, ethers.utils.parseEther('10000'))
    );
    const userBalanceAfter = await aaveToken.balanceOf(staker.address);
    expect(userBalanceAfter).eq(userBalanceBefore.add(rewards));
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
    const userRewards = await stakedAaveV2.getTotalRewardsBalance(userAddress);
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

  it('Claim & stake half rewards prior slashing', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;
    const ether = parseEther('1.0');
    // Increase time for bigger rewards
    await increaseTimeAndMine(1000);

    const halfRewards = (await stakeV3.getTotalRewardsBalance(staker.address)).div(2);

    const saveUserBalance = [
      await aaveToken.balanceOf(staker.address),
      await stakeV3.balanceOf(staker.address),
    ];
    const currentExchangeRate = await stakeV3.exchangeRate();

    const aaveStakedBefore = await aaveToken.balanceOf(stakeV3.address);

    await waitForTx(
      await stakeV3.connect(staker.signer).claimRewardsAndStake(staker.address, halfRewards)
    );

    const afterExchangeRate = await stakeV3.exchangeRate();

    const aaveStakedAfter = await aaveToken.balanceOf(stakeV3.address);

    const userBalanceAfterActions = [
      await aaveToken.balanceOf(staker.address),
      await stakeV3.balanceOf(staker.address),
    ];

    expect(userBalanceAfterActions[0]).to.be.eq(
      saveUserBalance[0],
      'Invalid aave user balance after action'
    );

    expect(userBalanceAfterActions[1]).to.be.eq(
      saveUserBalance[1].add(halfRewards.mul(ether).div(currentExchangeRate)),
      'invalid stkAAVE user balance after action'
    );

    expect(aaveStakedAfter).to.be.equal(
      aaveStakedBefore.add(halfRewards),
      'Invalid underlying balance'
    );

    expect(afterExchangeRate).to.be.equal(currentExchangeRate).to.be.eq(WAD);
  });

  it('Claim & stake all prior slashing', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;

    const ether = parseEther('1.0');

    const userAddress = staker.address;
    const userBalance = await stakeV3.balanceOf(userAddress);
    const saveUserBalance = [
      await aaveToken.balanceOf(staker.address),
      await stakeV3.balanceOf(staker.address),
    ];
    const userRewards = await stakeV3.stakerRewardsToClaim(userAddress);
    // // Get index before actions
    const userIndexBefore = await getUserIndex(stakeV3, userAddress, stakeV3.address);
    const currentExchangeRate = await stakeV3.exchangeRate();

    await waitForTx(
      await stakeV3.connect(staker.signer).claimRewardsAndStake(staker.address, MAX_UINT_AMOUNT)
    );

    const afterExchangeRate = await stakeV3.exchangeRate();

    // Get index after actions
    const userIndexAfter = await getUserIndex(stakeV3, userAddress, stakeV3.address);

    const expectedAccruedRewards = getRewards(userBalance, userIndexAfter, userIndexBefore);
    // Claim rewards

    const userBalanceAfterActions = [
      await aaveToken.balanceOf(staker.address),
      await stakeV3.balanceOf(staker.address),
    ];

    expect(userBalanceAfterActions[0]).to.be.equal(saveUserBalance[0]);
    expect(userBalanceAfterActions[1]).to.be.eq(
      saveUserBalance[1].add(
        expectedAccruedRewards.add(userRewards).mul(ether).div(currentExchangeRate)
      )
    );
    expect(afterExchangeRate).to.be.equal(currentExchangeRate).to.be.eq(WAD);
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

  it('Stakes using permit', async () => {
    const {
      aaveToken,
      users: [, staker, someone],
    } = testEnv;

    const { chainId } = await DRE.ethers.provider.getNetwork();
    if (!chainId) {
      fail("Current network doesn't have CHAIN ID");
    }

    const expiration = 0;

    const nonce = (await stakeV3._nonces(staker.address)).toNumber();

    const amount = parseEther('0.1');

    const msgParams = buildPermitParams(
      chainId,
      stakeV3.address,
      staker.address,
      stakeV3.address,
      nonce,
      amount.toString(),
      expiration.toFixed()
    );

    // reset approval
    await waitForTx(await aaveToken.connect(staker.signer).approve(stakeV3.address, 0));

    const stakerPrivateKey = require('../../test-wallets').accounts[0].secretKey;
    if (!stakerPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    const { v, r, s } = getSignatureFromTypedData(stakerPrivateKey, msgParams);

    const balanceBefore = await stakeV3.balanceOf(staker.address);
    const exchangeRate = await stakeV3.exchangeRate();
    const ether = parseEther('1.0');

    const aaveStakedBefore = await aaveToken.balanceOf(stakeV3.address);

    await waitForTx(
      await stakeV3
        .connect(someone.signer)
        .stakeWithPermit(staker.address, staker.address, amount, expiration, v, r, s)
    );

    const aaveStakedAfter = await aaveToken.balanceOf(stakeV3.address);

    expect(await stakeV3.balanceOf(staker.address)).to.be.eql(
      balanceBefore.add(amount.mul(ether).div(exchangeRate))
    );

    expect(aaveStakedAfter).to.be.eql(aaveStakedBefore.add(amount));
  });

  it('Fails claim rewards for someone using claimRewardsOnBehalf if not helper', async () => {
    const {
      aaveToken,
      users: [, staker, someone],
    } = testEnv;
    // Increase time for bigger rewards
    await increaseTimeAndMine(1000);

    const halfRewards = (await stakeV3.getTotalRewardsBalance(staker.address)).div(2);
    const saveUserBalance = await aaveToken.balanceOf(someone.address);

    await expect(
      stakeV3
        .connect(staker.signer)
        .claimRewardsOnBehalf(staker.address, someone.address, halfRewards)
    ).to.be.revertedWith('CALLER_NOT_CLAIM_HELPER');
    const userBalanceAfterActions = await aaveToken.balanceOf(someone.address);
    expect(userBalanceAfterActions).eq(saveUserBalance);
  });

  it('Helper claim half rewards for staker to someone using claimRewardsOnBehalf', async () => {
    const {
      aaveToken,
      users: [, staker, helper, someone],
    } = testEnv;
    // Increase time for bigger rewards
    await increaseTimeAndMine(1000);

    const halfRewards = (await stakeV3.getTotalRewardsBalance(staker.address)).div(2);
    const saveUserBalance = await aaveToken.balanceOf(someone.address);

    await waitForTx(
      await stakeV3
        .connect(helper.signer)
        .claimRewardsOnBehalf(staker.address, someone.address, halfRewards)
    );

    const userBalanceAfterActions = await aaveToken.balanceOf(someone.address);
    expect(userBalanceAfterActions).eq(saveUserBalance.add(halfRewards));
  });

  it('Helper tries to claim higher reward than current rewards balance', async () => {
    const {
      aaveToken,
      users: [, staker, helper, someone],
    } = testEnv;

    const time = await timeLatest();

    await setBlocktime(time.toNumber() + 1);

    const userBalanceBefore = await aaveToken.balanceOf(someone.address, { blockTag: 'pending' });
    const rewards = await stakeV3.getTotalRewardsBalance(staker.address, { blockTag: 'pending' });

    // Try to claim more amount than accumulated
    await stakeV3
      .connect(helper.signer)
      .claimRewardsOnBehalf(staker.address, someone.address, ethers.utils.parseEther('10000'));

    const userBalanceAfter = await aaveToken.balanceOf(someone.address);

    expect(userBalanceAfter).eq(userBalanceBefore.add(rewards));
  });

  it('Helper 1 claim all for staker to someone', async () => {
    const {
      aaveToken,
      users: [, staker, helper, someone],
    } = testEnv;

    const userAddress = staker.address;
    const userBalance = await stakeV3.balanceOf(userAddress);
    const userAaveBalance = await aaveToken.balanceOf(someone.address);
    const userRewards = await stakeV3.stakerRewardsToClaim(userAddress);
    // // Get index before actions
    const userIndexBefore = await getUserIndex(stakeV3, userAddress, stakeV3.address);

    await waitForTx(
      await stakeV3
        .connect(helper.signer)
        .claimRewardsOnBehalf(staker.address, someone.address, MAX_UINT_AMOUNT)
    );
    // Get index after actions
    const userIndexAfter = await getUserIndex(stakeV3, userAddress, stakeV3.address);

    const expectedAccruedRewards = getRewards(
      userBalance,
      userIndexAfter,
      userIndexBefore
    ).toString();
    // Claim rewards

    const userAaveBalanceAfterAction = (await aaveToken.balanceOf(someone.address)).toString();

    expect(userAaveBalanceAfterAction).to.be.equal(
      userAaveBalance.add(userRewards).add(expectedAccruedRewards)
    );
  });

  it('Stakes a bit more', async () => {
    const {
      aaveToken,
      users: [, staker, helper, someone],
    } = testEnv;
    const amount = parseEther('0.1');
    await waitForTx(
      await aaveToken.connect(staker.signer).approve(stakeV3.address, MAX_UINT_AMOUNT)
    );
    await waitForTx(await stakeV3.connect(staker.signer).stake(staker.address, amount));
  });

  it('Claim & stake half rewards', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;
    const ether = parseEther('1.0');
    // Increase time for bigger rewards
    await increaseTimeAndMine(1000);

    const halfRewards = (await stakeV3.getTotalRewardsBalance(staker.address)).div(2);

    const saveUserBalance = [
      await aaveToken.balanceOf(staker.address),
      await stakeV3.balanceOf(staker.address),
    ];
    const currentExchangeRate = await stakeV3.exchangeRate();

    const aaveStakedBefore = await aaveToken.balanceOf(stakeV3.address);

    await waitForTx(
      await stakeV3.connect(staker.signer).claimRewardsAndStake(staker.address, halfRewards)
    );

    const afterExchangeRate = await stakeV3.exchangeRate();

    const aaveStakedAfter = await aaveToken.balanceOf(stakeV3.address);

    const userBalanceAfterActions = [
      await aaveToken.balanceOf(staker.address),
      await stakeV3.balanceOf(staker.address),
    ];

    expect(userBalanceAfterActions[0]).to.be.eq(
      saveUserBalance[0],
      'Invalid aave user balance after action'
    );

    expect(userBalanceAfterActions[1]).to.be.eq(
      saveUserBalance[1].add(halfRewards.mul(ether).div(currentExchangeRate)),
      'invalid stkAAVE user balance after action'
    );

    expect(aaveStakedAfter).to.be.equal(
      aaveStakedBefore.add(halfRewards),
      'Invalid underlying balance'
    );

    expect(afterExchangeRate).to.be.equal(currentExchangeRate);
  });

  it('Claim & stake all', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;

    const ether = parseEther('1.0');

    const userAddress = staker.address;
    const userBalance = await stakeV3.balanceOf(userAddress);
    const saveUserBalance = [
      await aaveToken.balanceOf(staker.address),
      await stakeV3.balanceOf(staker.address),
    ];
    const userRewards = await stakeV3.stakerRewardsToClaim(userAddress);
    // // Get index before actions
    const userIndexBefore = await getUserIndex(stakeV3, userAddress, stakeV3.address);
    const currentExchangeRate = await stakeV3.exchangeRate();

    await waitForTx(
      await stakeV3.connect(staker.signer).claimRewardsAndStake(staker.address, MAX_UINT_AMOUNT)
    );

    const afterExchangeRate = await stakeV3.exchangeRate();

    // Get index after actions
    const userIndexAfter = await getUserIndex(stakeV3, userAddress, stakeV3.address);

    const expectedAccruedRewards = getRewards(userBalance, userIndexAfter, userIndexBefore);
    // Claim rewards

    const userBalanceAfterActions = [
      await aaveToken.balanceOf(staker.address),
      await stakeV3.balanceOf(staker.address),
    ];

    expect(userBalanceAfterActions[0]).to.be.equal(saveUserBalance[0]);
    expect(userBalanceAfterActions[1]).to.be.eq(
      saveUserBalance[1].add(
        expectedAccruedRewards.add(userRewards).mul(ether).div(currentExchangeRate)
      )
    );
    expect(afterExchangeRate).to.be.equal(currentExchangeRate);
  });

  it('Stakes a bit more', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;
    const amount = parseEther('0.1');
    await waitForTx(
      await aaveToken.connect(staker.signer).approve(stakeV3.address, MAX_UINT_AMOUNT)
    );
    await waitForTx(await stakeV3.connect(staker.signer).stake(staker.address, amount));
  });

  it('Claim & stake half rewards to someone else', async () => {
    const {
      aaveToken,
      users: [, staker, someone],
    } = testEnv;
    const ether = parseEther('1.0');
    // Increase time for bigger rewards
    await increaseTimeAndMine(1000);

    const halfRewards = (await stakeV3.getTotalRewardsBalance(staker.address)).div(2);
    const saveUserBalance = [
      await aaveToken.balanceOf(someone.address),
      await stakeV3.balanceOf(someone.address),
    ];
    const currentExchangeRate = await stakeV3.exchangeRate();

    await waitForTx(
      await stakeV3.connect(staker.signer).claimRewardsAndStake(someone.address, halfRewards)
    );
    const afterExchangeRate = await stakeV3.exchangeRate();

    const userBalanceAfterActions = [
      await aaveToken.balanceOf(someone.address),
      await stakeV3.balanceOf(someone.address),
    ];

    expect(userBalanceAfterActions[0].eq(saveUserBalance[0]));
    expect(userBalanceAfterActions[1]).eq(
      saveUserBalance[1].add(halfRewards.mul(ether).div(currentExchangeRate))
    );
    expect(afterExchangeRate)
      .to.be.equal(currentExchangeRate)
      .equal(ethers.utils.parseEther('0.8'));
  });

  it('Claim & stake all to someone else', async () => {
    const {
      aaveToken,
      users: [, staker, someone],
    } = testEnv;

    const ether = parseEther('1.0');

    const userAddress = staker.address;
    const userBalance = await stakeV3.balanceOf(userAddress);
    const saveUserBalance = [
      await aaveToken.balanceOf(someone.address),
      await stakeV3.balanceOf(someone.address),
    ];
    const userRewards = await stakeV3.stakerRewardsToClaim(userAddress);
    // // Get index before actions
    const userIndexBefore = await getUserIndex(stakeV3, userAddress, stakeV3.address);
    const currentExchangeRate = await stakeV3.exchangeRate();

    await waitForTx(
      await stakeV3.connect(staker.signer).claimRewardsAndStake(someone.address, MAX_UINT_AMOUNT)
    );
    const afterExchangeRate = await stakeV3.exchangeRate();
    // Get index after actions
    const userIndexAfter = await getUserIndex(stakeV3, userAddress, stakeV3.address);

    const expectedAccruedRewards = getRewards(userBalance, userIndexAfter, userIndexBefore);
    // Claim rewards

    const userBalanceAfterActions = [
      await aaveToken.balanceOf(someone.address),
      await stakeV3.balanceOf(someone.address),
    ];

    expect(userBalanceAfterActions[0]).to.be.equal(saveUserBalance[0]);
    expect(userBalanceAfterActions[1]).to.be.equal(
      saveUserBalance[1].add(
        expectedAccruedRewards.add(userRewards).mul(ether).div(currentExchangeRate)
      )
    );
    expect(afterExchangeRate)
      .to.be.equal(currentExchangeRate)
      .to.be.equal(ethers.utils.parseEther('0.8'));
  });

  it('Stakes a bit more', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;
    const amount = parseEther('0.1');
    waitForTx(await aaveToken.connect(staker.signer).approve(stakeV3.address, MAX_UINT_AMOUNT));
    waitForTx(await stakeV3.connect(staker.signer).stake(staker.address, amount));
  });

  it('Fails claim rewards and stake by non helper for staker using claimRewardsOnBehalf', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;
    // Increase time for bigger rewards
    await increaseTimeAndMine(1000);

    const halfRewards = (await stakeV3.getTotalRewardsBalance(staker.address)).div(2);
    const saveUserBalance = await aaveToken.balanceOf(staker.address);

    await expect(
      stakeV3
        .connect(staker.signer)
        .claimRewardsAndStakeOnBehalf(staker.address, staker.address, halfRewards)
    ).to.be.revertedWith('CALLER_NOT_CLAIM_HELPER');
    const userBalanceAfterActions = await aaveToken.balanceOf(staker.address);
    expect(userBalanceAfterActions).eq(saveUserBalance);
  });

  it('Helper claim & stake half rewards for staker using claimRewardsOnBehalf', async () => {
    const {
      aaveToken,
      users: [, staker, helper],
    } = testEnv;
    const ether = parseEther('1');
    // Increase time for bigger rewards
    await increaseTimeAndMine(1000);

    const halfRewards = (await stakeV3.getTotalRewardsBalance(staker.address)).div(2);
    const saveUserBalance = [
      await aaveToken.balanceOf(staker.address),
      await stakeV3.balanceOf(staker.address),
    ];
    const currentExchangeRate = await stakeV3.exchangeRate();

    await stakeV3
      .connect(helper.signer)
      .claimRewardsAndStakeOnBehalf(staker.address, staker.address, halfRewards);

    const userBalanceAfterActions = [
      await aaveToken.balanceOf(staker.address),
      await stakeV3.balanceOf(staker.address),
    ];
    expect(userBalanceAfterActions[0]).eq(saveUserBalance[0]);
    expect(userBalanceAfterActions[1]).eq(
      saveUserBalance[1].add(halfRewards.mul(ether).div(currentExchangeRate))
    );
  });

  it('Helper 1 claims & stakes all for staker', async () => {
    const {
      aaveToken,
      users: [, staker, helper],
    } = testEnv;

    const ether = parseEther('1.0');
    const userAddress = staker.address;
    const userBalance = await stakeV3.balanceOf(userAddress);
    const saveUserBalance = [
      await aaveToken.balanceOf(staker.address),
      await stakeV3.balanceOf(staker.address),
    ];
    const userRewards = await stakeV3.stakerRewardsToClaim(userAddress);
    // // Get index before actions
    const userIndexBefore = await getUserIndex(stakeV3, userAddress, stakeV3.address);
    const currentExchangeRate = await stakeV3.exchangeRate();

    await waitForTx(
      await stakeV3
        .connect(helper.signer)
        .claimRewardsAndStakeOnBehalf(staker.address, staker.address, MAX_UINT_AMOUNT)
    );
    // Get index after actions
    const userIndexAfter = await getUserIndex(stakeV3, userAddress, stakeV3.address);

    const expectedAccruedRewards = getRewards(userBalance, userIndexAfter, userIndexBefore);
    // Claim rewards

    const userBalanceAfterActions = [
      await aaveToken.balanceOf(staker.address),
      await stakeV3.balanceOf(staker.address),
    ];

    expect(userBalanceAfterActions[0]).to.be.equal(saveUserBalance[0]);
    expect(userBalanceAfterActions[1]).to.be.equal(
      saveUserBalance[1].add(
        expectedAccruedRewards.add(userRewards).mul(ether).div(currentExchangeRate)
      )
    );
  });

  it('Stakes a bit more', async () => {
    const {
      aaveToken,
      users: [, staker, helper, someone],
    } = testEnv;
    const amount = parseEther('0.1');
    const balanceBefore = await stakeV3.balanceOf(staker.address);
    waitForTx(await aaveToken.connect(staker.signer).approve(stakeV3.address, MAX_UINT_AMOUNT));
    waitForTx(await stakeV3.connect(staker.signer).stake(staker.address, amount));
  });

  it('Fails to claim and reward by non helper from staker to someone using claimRewardsOnBehalf', async () => {
    const {
      aaveToken,
      users: [, staker, helper, someone],
    } = testEnv;
    // Increase time for bigger rewards
    await increaseTimeAndMine(1000);

    const halfRewards = (await stakeV3.getTotalRewardsBalance(staker.address)).div(2);
    const saveUserBalance = await aaveToken.balanceOf(someone.address);

    await expect(
      stakeV3
        .connect(staker.signer)
        .claimRewardsAndStakeOnBehalf(staker.address, someone.address, halfRewards)
    ).to.be.revertedWith('CALLER_NOT_CLAIM_HELPER');
    const userBalanceAfterActions = await aaveToken.balanceOf(someone.address);
    expect(userBalanceAfterActions).eq(saveUserBalance);
  });

  it('Helper claim & stake half rewards for staker to someone using claimRewardsOnBehalf', async () => {
    const {
      aaveToken,
      users: [, staker, helper, someone],
    } = testEnv;
    const ether = parseEther('1.0');
    // Increase time for bigger rewards
    await increaseTimeAndMine(1000);

    const halfRewards = (await stakeV3.getTotalRewardsBalance(staker.address)).div(2);
    const saveUserBalance = [
      await aaveToken.balanceOf(someone.address),
      await stakeV3.balanceOf(someone.address),
    ];
    const currentExchangeRate = await stakeV3.exchangeRate();

    stakeV3
      .connect(helper.signer)
      .claimRewardsAndStakeOnBehalf(staker.address, someone.address, halfRewards);

    const userBalanceAfterActions = [
      await aaveToken.balanceOf(someone.address),
      await stakeV3.balanceOf(someone.address),
    ];
    expect(userBalanceAfterActions[0]).eq(saveUserBalance[0]);
    expect(userBalanceAfterActions[1]).eq(
      saveUserBalance[1].add(halfRewards.mul(ether).div(currentExchangeRate))
    );
  });

  it('Helper 1 claim & staker all for staker to someone', async () => {
    const {
      stakedAaveV2,
      aaveToken,
      users: [, staker, helper, someone],
    } = testEnv;

    const ether = parseEther('1.0');
    const userAddress = staker.address;
    const userBalance = await stakeV3.balanceOf(userAddress);
    const saveUserBalance = [
      await aaveToken.balanceOf(someone.address),
      await stakeV3.balanceOf(someone.address),
    ];
    const userRewards = await stakeV3.stakerRewardsToClaim(userAddress);
    // // Get index before actions
    const userIndexBefore = await getUserIndex(stakeV3, userAddress, stakeV3.address);
    const currentExchangeRate = await stakeV3.exchangeRate();

    await waitForTx(
      await stakeV3
        .connect(helper.signer)
        .claimRewardsAndStakeOnBehalf(staker.address, someone.address, MAX_UINT_AMOUNT)
    );
    // Get index after actions
    const userIndexAfter = await getUserIndex(stakeV3, userAddress, stakeV3.address);

    const expectedAccruedRewards = getRewards(userBalance, userIndexAfter, userIndexBefore);
    // Claim rewards

    const userBalanceAfterActions = [
      await aaveToken.balanceOf(someone.address),
      await stakeV3.balanceOf(someone.address),
    ];

    expect(userBalanceAfterActions[0]).to.be.equal(saveUserBalance[0]);
    expect(userBalanceAfterActions[1]).to.be.equal(
      saveUserBalance[1].add(
        expectedAccruedRewards.add(userRewards).mul(ether).div(currentExchangeRate)
      )
    );
  });

  it('Stakes a bit more, prepare window and  take snapshots', async () => {
    const {
      aaveToken,
      users: [, , helper, admin, staker],
    } = testEnv;
    const amount = parseEther('10');
    const balanceBefore = await stakeV3.balanceOf(staker.address);
    await stakeV3.connect(admin.signer).setCooldownPause(false);

    waitForTx(await aaveToken.connect(staker.signer).approve(stakeV3.address, MAX_UINT_AMOUNT));
    waitForTx(await stakeV3.connect(staker.signer).stake(staker.address, amount));
    waitForTx(await stakeV3.connect(staker.signer).stake(staker.address, amount));
    await stakeV3.connect(staker.signer).cooldown();
    await increaseTimeAndMine(new BigNumber(COOLDOWN_SECONDS).plus(1000).toNumber());
    snap = await evmSnapshot();
  });
  it('Fails to redeem on behalf by non helper', async () => {
    const {
      aaveToken,
      users: [, , helper, someone, staker],
    } = testEnv;
    // Increase time for bigger rewards
    await evmRevert(snap);
    snap = await evmSnapshot();

    const halfRedeem = (await stakeV3.balanceOf(staker.address)).div(2);
    const saveUserBalance = await aaveToken.balanceOf(someone.address);

    await expect(
      stakeV3.connect(staker.signer).redeemOnBehalf(staker.address, someone.address, halfRedeem)
    ).to.be.revertedWith('CALLER_NOT_CLAIM_HELPER');
    const userBalanceAfterActions = await aaveToken.balanceOf(someone.address);
    expect(userBalanceAfterActions).eq(saveUserBalance);
  });

  it('Fails to claim and unstake by non helper from staker to someone using claimRewardsAndRedeemOnBehalf', async () => {
    const {
      aaveToken,
      users: [, , helper, someone, staker],
    } = testEnv;
    // Increase time for bigger rewards
    await evmRevert(snap);
    snap = await evmSnapshot();

    const halfRewards = (await stakeV3.getTotalRewardsBalance(staker.address)).div(2);
    const halfRedeem = (await stakeV3.balanceOf(staker.address)).div(2);
    const saveUserBalance = await aaveToken.balanceOf(someone.address);

    await expect(
      stakeV3
        .connect(staker.signer)
        .claimRewardsAndRedeemOnBehalf(staker.address, someone.address, halfRewards, halfRedeem)
    ).to.be.revertedWith('CALLER_NOT_CLAIM_HELPER');
    const userBalanceAfterActions = await aaveToken.balanceOf(someone.address);
    expect(userBalanceAfterActions).eq(saveUserBalance);
  });

  it('Helper succeeds to redeem half on behalf of staker to someone using redeemOnBehalf', async () => {
    const {
      aaveToken,
      users: [, , helper, someone, staker],
    } = testEnv;
    // Increase time for bigger rewards
    await evmRevert(snap);
    snap = await evmSnapshot();

    const ether = parseEther('1.0');
    const halfRedeem = (await stakeV3.balanceOf(staker.address)).div(2);
    const receiverAaveBalance = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalance = await stakeV3.balanceOf(staker.address);
    const currentExchangeRate = await stakeV3.exchangeRate();

    waitForTx(
      await stakeV3
        .connect(helper.signer)
        .redeemOnBehalf(staker.address, someone.address, halfRedeem)
    );

    const receiverAaveBalanceAfter = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalancerAfter = await stakeV3.balanceOf(staker.address);
    expect(stakerStkAaveBalancerAfter).eq(stakerStkAaveBalance.sub(halfRedeem));
    expect(receiverAaveBalanceAfter).eq(
      receiverAaveBalance.add(halfRedeem.mul(currentExchangeRate).div(ether))
    );
  });
  it('Staker claims half & unstake half to someone using claimRewardsAndRedeem', async () => {
    const {
      aaveToken,
      users: [, , helper, someone, staker],
    } = testEnv;
    const ether = parseEther('1.0');
    await evmRevert(snap);
    snap = await evmSnapshot();

    const halfRewards = (await stakeV3.getTotalRewardsBalance(staker.address)).div(2);
    const halfRedeem = (await stakeV3.balanceOf(staker.address)).div(2);
    const receiverAaveBalance = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalance = await stakeV3.balanceOf(staker.address);
    const currentExchangeRate = await stakeV3.exchangeRate();

    waitForTx(
      await stakeV3
        .connect(staker.signer)
        .claimRewardsAndRedeem(someone.address, halfRewards, halfRedeem)
    );

    const receiverAaveBalanceAfter = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalancerAfter = await stakeV3.balanceOf(staker.address);
    expect(stakerStkAaveBalancerAfter).eq(stakerStkAaveBalance.sub(halfRedeem));
    expect(receiverAaveBalanceAfter).eq(
      receiverAaveBalance.add(halfRewards.add(halfRedeem.mul(currentExchangeRate).div(ether)))
    );
  });
  it('Helper claim half & unstake half for staker to someone using claimRewardsAndRedeemOnBehalf', async () => {
    const {
      aaveToken,
      users: [, , helper, someone, staker],
    } = testEnv;
    const ether = parseEther('1.0');
    await evmRevert(snap);
    snap = await evmSnapshot();

    const halfRewards = (await stakeV3.getTotalRewardsBalance(staker.address)).div(2);
    const halfRedeem = (await stakeV3.balanceOf(staker.address)).div(2);
    const receiverAaveBalance = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalance = await stakeV3.balanceOf(staker.address);
    const currentExchangeRate = await stakeV3.exchangeRate();

    waitForTx(
      await stakeV3
        .connect(helper.signer)
        .claimRewardsAndRedeemOnBehalf(staker.address, someone.address, halfRewards, halfRedeem)
    );

    const receiverAaveBalanceAfter = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalancerAfter = await stakeV3.balanceOf(staker.address);
    expect(stakerStkAaveBalancerAfter).eq(stakerStkAaveBalance.sub(halfRedeem));
    expect(receiverAaveBalanceAfter).eq(
      receiverAaveBalance.add(halfRewards.add(halfRedeem.mul(currentExchangeRate).div(ether)))
    );
  });
  it('Staker claim half & unstake full to someone using claimRewardsAndRedeem', async () => {
    const {
      aaveToken,
      users: [, , helper, someone, staker],
    } = testEnv;
    const ether = parseEther('1.0');
    await evmRevert(snap);
    snap = await evmSnapshot();

    const halfRewards = (await stakeV3.getTotalRewardsBalance(staker.address)).div(2);
    const receiverAaveBalance = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalance = await stakeV3.balanceOf(staker.address);
    const currentExchangeRate = await stakeV3.exchangeRate();

    waitForTx(
      await stakeV3
        .connect(staker.signer)
        .claimRewardsAndRedeem(someone.address, halfRewards, MAX_UINT_AMOUNT)
    );

    const receiverAaveBalanceAfter = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalancerAfter = await stakeV3.balanceOf(staker.address);
    expect(stakerStkAaveBalancerAfter).eq(parseEther('0'));
    expect(receiverAaveBalanceAfter).eq(
      receiverAaveBalance.add(
        halfRewards.add(stakerStkAaveBalance.mul(currentExchangeRate).div(ether))
      )
    );
  });
  it('Helper claim half & unstake full for staker to someone using claimRewardsAndRedeemOnBehalf', async () => {
    const {
      aaveToken,
      users: [, , helper, someone, staker],
    } = testEnv;
    const ether = parseEther('1.0');
    await evmRevert(snap);
    snap = await evmSnapshot();

    const halfRewards = (await stakeV3.getTotalRewardsBalance(staker.address)).div(2);
    const receiverAaveBalance = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalance = await stakeV3.balanceOf(staker.address);
    const currentExchangeRate = await stakeV3.exchangeRate();

    waitForTx(
      await stakeV3
        .connect(helper.signer)
        .claimRewardsAndRedeemOnBehalf(
          staker.address,
          someone.address,
          halfRewards,
          MAX_UINT_AMOUNT
        )
    );

    const receiverAaveBalanceAfter = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalancerAfter = await stakeV3.balanceOf(staker.address);
    expect(stakerStkAaveBalancerAfter).eq(parseEther('0'));
    expect(receiverAaveBalanceAfter).eq(
      receiverAaveBalance.add(
        halfRewards.add(stakerStkAaveBalance.mul(currentExchangeRate).div(ether))
      )
    );
  });
  it('Helper succeeds to redeem full on behalf of staker to someone using redeemOnBehalf', async () => {
    const {
      aaveToken,
      users: [, , helper, someone, staker],
    } = testEnv;
    // Increase time for bigger rewards
    await evmRevert(snap);
    snap = await evmSnapshot();

    const ether = parseEther('1.0');
    const receiverAaveBalance = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalance = await stakeV3.balanceOf(staker.address);
    const currentExchangeRate = await stakeV3.exchangeRate();

    waitForTx(
      await stakeV3
        .connect(helper.signer)
        .redeemOnBehalf(staker.address, someone.address, MAX_UINT_AMOUNT)
    );

    const receiverAaveBalanceAfter = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalancerAfter = await stakeV3.balanceOf(staker.address);
    expect(stakerStkAaveBalancerAfter).eq(parseEther('0'));
    expect(receiverAaveBalanceAfter).eq(
      receiverAaveBalance.add(stakerStkAaveBalance.mul(currentExchangeRate).div(ether))
    );
  });
  it('Staker claim full & unstake full to someone using claimRewardsAndRedeem', async () => {
    const {
      aaveToken,
      users: [, , helper, someone, staker],
    } = testEnv;
    const ether = parseEther('1.0');
    await evmRevert(snap);
    snap = await evmSnapshot();

    const fullRewards = await stakeV3.stakerRewardsToClaim(staker.address);
    const receiverAaveBalance = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalance = await stakeV3.balanceOf(staker.address);
    const userIndexBefore = await getUserIndex(stakeV3, staker.address, stakeV3.address);
    const currentExchangeRate = await stakeV3.exchangeRate();
    waitForTx(
      await stakeV3
        .connect(staker.signer)
        .claimRewardsAndRedeem(someone.address, MAX_UINT_AMOUNT, MAX_UINT_AMOUNT)
    );

    const userIndexAfter = await getUserIndex(stakeV3, staker.address, stakeV3.address);
    const expectedAccruedRewards = getRewards(
      stakerStkAaveBalance,
      userIndexAfter,
      userIndexBefore
    );
    const receiverAaveBalanceAfter = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalancerAfter = await stakeV3.balanceOf(staker.address);
    expect(stakerStkAaveBalancerAfter).eq(parseEther('0'));
    expect(receiverAaveBalanceAfter).eq(
      receiverAaveBalance
        .add(fullRewards)
        .add(expectedAccruedRewards)
        .add(stakerStkAaveBalance.mul(currentExchangeRate).div(ether))
    );
  });
  it('Helper claim full & unstake full for staker to someone using claimRewardsAndRedeemOnBehalf', async () => {
    const {
      aaveToken,
      users: [, , helper, someone, staker],
    } = testEnv;
    const ether = parseEther('1.0');
    await evmRevert(snap);
    snap = await evmSnapshot();

    const fullRewards = await stakeV3.stakerRewardsToClaim(staker.address);
    const receiverAaveBalance = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalance = await stakeV3.balanceOf(staker.address);
    const userIndexBefore = await getUserIndex(stakeV3, staker.address, stakeV3.address);
    const currentExchangeRate = await stakeV3.exchangeRate();
    waitForTx(
      await stakeV3
        .connect(helper.signer)
        .claimRewardsAndRedeemOnBehalf(
          staker.address,
          someone.address,
          MAX_UINT_AMOUNT,
          MAX_UINT_AMOUNT
        )
    );

    const userIndexAfter = await getUserIndex(stakeV3, staker.address, stakeV3.address);
    const expectedAccruedRewards = getRewards(
      stakerStkAaveBalance,
      userIndexAfter,
      userIndexBefore
    );
    const receiverAaveBalanceAfter = await aaveToken.balanceOf(someone.address);
    const stakerStkAaveBalancerAfter = await stakeV3.balanceOf(staker.address);
    expect(stakerStkAaveBalancerAfter).eq(parseEther('0'));
    expect(receiverAaveBalanceAfter).eq(
      receiverAaveBalance
        .add(fullRewards)
        .add(expectedAccruedRewards)
        .add(stakerStkAaveBalance.mul(currentExchangeRate).div(ether))
    );
  });
});
