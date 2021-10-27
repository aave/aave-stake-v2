import { makeSuite, stakedAaveInitializeTimestamp, TestEnv } from '../helpers/make-suite';
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
import { BigNumberish, ethers } from 'ethers';
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
import { formatUnits, parseEther, parseUnits } from 'ethers/lib/utils';
import { expect } from 'chai';

const SLASHING_ADMIN = 0;
const COOLDOWN_ADMIN = 1;
const CLAIM_HELPER_ROLE = 2;

type AssetConfig = {
  totalStaked: BigNumberish;
  emissionPerSecond: BigNumberish;
};

makeSuite('StakedAave V3 emergency', (testEnv: TestEnv) => {
  let stakeV3: StakedAaveV3;
  let snap: string;

  let startBalance = parseUnits('100', 18);

  before('setup', async () => {
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
      await stakeV3['initialize(address,address,address,uint256,string,string,uint8)'](
        users[0].address,
        users[1].address,
        users[2].address,
        '2000',
        'Staked AAVE',
        'stkAAVE',
        18
      )
    );

    const slashingAdmin = await stakeV3.getAdmin(SLASHING_ADMIN); //slash admin
    const cooldownAdmin = await stakeV3.getAdmin(COOLDOWN_ADMIN); //cooldown admin
    const claimAdmin = await stakeV3.getAdmin(CLAIM_HELPER_ROLE); //claim admin // helper contract

    expect(slashingAdmin).to.be.equal(users[0].address);
    expect(cooldownAdmin).to.be.equal(users[1].address);
    expect(claimAdmin).to.be.equal(users[2].address);

    // Init and check rewards
    await compareRewardsAtAction(stakeV3, users[0].address, () => []);
  });

  it('Stake before emergency', async () => {
    const {
      aaveToken,
      users: [user],
    } = testEnv;
    expect(await aaveToken.balanceOf(user.address)).to.be.eq(startBalance);

    await aaveToken.connect(user.signer).approve(stakeV3.address, MAX_UINT_AMOUNT);

    await stakeV3.connect(user.signer).stake(user.address, startBalance);
    expect(await stakeV3.balanceOf(user.address)).to.be.eq(startBalance);
    expect(await aaveToken.balanceOf(user.address)).to.be.eq(0);
  });

  it('Enter an emergency', async () => {
    const {
      users: [slashingAdmin, cooldownAdmin],
    } = testEnv;
    expect(await stakeV3.getEmergencyShutdown()).to.be.false;
    await expect(
      stakeV3.connect(slashingAdmin.signer).setEmergencyShutdown(true)
    ).to.be.revertedWith('CALLER_NOT_COOLDOWN_ADMIN');
    expect(await stakeV3.connect(cooldownAdmin.signer).setEmergencyShutdown(true));
    expect(await stakeV3.getEmergencyShutdown()).to.be.true;
  });

  it('Staking, expect noop', async () => {
    const {
      aaveToken,
      users: [, user],
    } = testEnv;
    await aaveToken.connect(user.signer).approve(stakeV3.address, MAX_UINT_AMOUNT);

    expect(await stakeV3.balanceOf(user.address)).to.be.eq(0);

    await stakeV3.connect(user.signer).stake(user.address, startBalance);
    expect(await stakeV3.balanceOf(user.address)).to.be.eq(0);
  });

  it('Staking with permit, expect noop', async () => {
    // TODO:
    const {
      aaveToken,
      users: [, user],
    } = testEnv;
    expect(await stakeV3.balanceOf(user.address)).to.be.eq(0);

    await stakeV3.connect(user.signer).stake(user.address, startBalance);
    expect(await stakeV3.balanceOf(user.address)).to.be.eq(0);
  });

  it('Stakes using permit, expect noop', async () => {
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
    const aaveStakedBefore = await aaveToken.balanceOf(stakeV3.address);

    await waitForTx(
      await stakeV3
        .connect(someone.signer)
        .stakeWithPermit(staker.address, staker.address, amount, expiration, v, r, s)
    );

    expect(await stakeV3.balanceOf(staker.address)).to.be.eq(balanceBefore);
    expect(await aaveToken.balanceOf(stakeV3.address)).to.be.eq(aaveStakedBefore);
  });

  it('Cooldown', async () => {
    const {
      users: [user],
    } = testEnv;

    const coolDownBefore = await stakeV3.stakersCooldowns(user.address);

    await stakeV3.connect(user.signer).cooldown();

    expect(await stakeV3.stakersCooldowns(user.address)).to.be.eq(coolDownBefore);
  });

  it('Redeem, expect noop', async () => {
    const {
      aaveToken,
      users: [stakingUser, nonStakingUser],
    } = testEnv;

    await increaseTimeAndMine(64000);

    const stakingUserReward = await stakeV3.getTotalRewardsBalance(stakingUser.address);
    const stakingUserBalance = await aaveToken.balanceOf(stakingUser.address);
    const stakingUserStkBalance = await stakeV3.balanceOf(stakingUser.address);
    const nonStakingUserReward = await stakeV3.getTotalRewardsBalance(nonStakingUser.address);
    const nonStakingUserBalance = await aaveToken.balanceOf(nonStakingUser.address);
    const nonStakingUserStkBalance = await stakeV3.balanceOf(nonStakingUser.address);

    expect(stakingUserBalance).to.be.eq(0);
    expect(stakingUserStkBalance).to.be.eq(parseUnits('100'));
    expect(stakingUserReward).to.be.gt(0);
    expect(nonStakingUserBalance).to.be.eq(parseUnits('100'));
    expect(nonStakingUserStkBalance).to.be.eq(0);
    expect(nonStakingUserReward).to.be.eq(0);

    await stakeV3.connect(stakingUser.signer).redeem(stakingUser.address, MAX_UINT_AMOUNT);

    expect(await stakeV3.getTotalRewardsBalance(stakingUser.address)).to.be.gte(stakingUserReward);
    expect(await stakeV3.getTotalRewardsBalance(nonStakingUser.address)).to.be.eq(0);

    expect(await aaveToken.balanceOf(stakingUser.address)).to.be.eq(
      stakingUserBalance,
      'Staking user claimed rewards'
    );
  });

  it('RedeemOnBehalf, expect noop', async () => {
    const {
      aaveToken,
      users: [stakingUser, nonStakingUser],
    } = testEnv;

    await increaseTimeAndMine(64000);

    const stakingUserReward = await stakeV3.getTotalRewardsBalance(stakingUser.address);
    const stakingUserBalance = await aaveToken.balanceOf(stakingUser.address);
    const stakingUserStkBalance = await stakeV3.balanceOf(stakingUser.address);
    const nonStakingUserReward = await stakeV3.getTotalRewardsBalance(nonStakingUser.address);
    const nonStakingUserBalance = await aaveToken.balanceOf(nonStakingUser.address);
    const nonStakingUserStkBalance = await stakeV3.balanceOf(nonStakingUser.address);

    expect(stakingUserBalance).to.be.eq(0);
    expect(stakingUserStkBalance).to.be.eq(parseUnits('100'));
    expect(stakingUserReward).to.be.gt(0);
    expect(nonStakingUserBalance).to.be.eq(parseUnits('100'));
    expect(nonStakingUserStkBalance).to.be.eq(0);
    expect(nonStakingUserReward).to.be.eq(0);

    await stakeV3
      .connect(stakingUser.signer)
      .redeemOnBehalf(stakingUser.address, stakingUser.address, MAX_UINT_AMOUNT);

    expect(await stakeV3.getTotalRewardsBalance(stakingUser.address)).to.be.gte(stakingUserReward);
    expect(await stakeV3.getTotalRewardsBalance(nonStakingUser.address)).to.be.eq(0);

    expect(await aaveToken.balanceOf(stakingUser.address)).to.be.eq(
      stakingUserBalance,
      'Staking user claimed rewards'
    );
  });

  it('ClaimRewards, expect noop', async () => {
    const {
      aaveToken,
      users: [stakingUser, nonStakingUser],
    } = testEnv;

    await increaseTimeAndMine(64000);

    const stakingUserReward = await stakeV3.getTotalRewardsBalance(stakingUser.address);
    const stakingUserBalance = await aaveToken.balanceOf(stakingUser.address);
    const stakingUserStkBalance = await stakeV3.balanceOf(stakingUser.address);
    const nonStakingUserReward = await stakeV3.getTotalRewardsBalance(nonStakingUser.address);
    const nonStakingUserBalance = await aaveToken.balanceOf(nonStakingUser.address);
    const nonStakingUserStkBalance = await stakeV3.balanceOf(nonStakingUser.address);

    expect(stakingUserBalance).to.be.eq(0);
    expect(stakingUserStkBalance).to.be.eq(parseUnits('100'));
    expect(stakingUserReward).to.be.gt(0);
    expect(nonStakingUserBalance).to.be.eq(parseUnits('100'));
    expect(nonStakingUserStkBalance).to.be.eq(0);
    expect(nonStakingUserReward).to.be.eq(0);

    await stakeV3.connect(stakingUser.signer).claimRewards(stakingUser.address, MAX_UINT_AMOUNT);

    expect(await stakeV3.getTotalRewardsBalance(stakingUser.address)).to.be.gte(stakingUserReward);
    expect(await stakeV3.getTotalRewardsBalance(nonStakingUser.address)).to.be.eq(0);

    expect(await aaveToken.balanceOf(stakingUser.address)).to.be.eq(
      stakingUserBalance,
      'Staking user claimed rewards'
    );
  });

  it('ClaimRewardsOnBehalf, expect noop', async () => {
    const {
      aaveToken,
      users: [stakingUser, nonStakingUser],
    } = testEnv;

    await increaseTimeAndMine(64000);

    const stakingUserReward = await stakeV3.getTotalRewardsBalance(stakingUser.address);
    const stakingUserBalance = await aaveToken.balanceOf(stakingUser.address);
    const stakingUserStkBalance = await stakeV3.balanceOf(stakingUser.address);
    const nonStakingUserReward = await stakeV3.getTotalRewardsBalance(nonStakingUser.address);
    const nonStakingUserBalance = await aaveToken.balanceOf(nonStakingUser.address);
    const nonStakingUserStkBalance = await stakeV3.balanceOf(nonStakingUser.address);

    expect(stakingUserBalance).to.be.eq(0);
    expect(stakingUserStkBalance).to.be.eq(parseUnits('100'));
    expect(stakingUserReward).to.be.gt(0);
    expect(nonStakingUserBalance).to.be.eq(parseUnits('100'));
    expect(nonStakingUserStkBalance).to.be.eq(0);
    expect(nonStakingUserReward).to.be.eq(0);

    await stakeV3
      .connect(stakingUser.signer)
      .claimRewardsOnBehalf(stakingUser.address, stakingUser.address, MAX_UINT_AMOUNT);

    expect(await stakeV3.getTotalRewardsBalance(stakingUser.address)).to.be.gte(stakingUserReward);
    expect(await stakeV3.getTotalRewardsBalance(nonStakingUser.address)).to.be.eq(0);

    expect(await aaveToken.balanceOf(stakingUser.address)).to.be.eq(
      stakingUserBalance,
      'Staking user claimed rewards'
    );
  });

  it('ClaimRewardsAndStake, expect noop', async () => {
    const {
      aaveToken,
      users: [stakingUser, nonStakingUser],
    } = testEnv;

    await increaseTimeAndMine(64000);

    const stakingUserReward = await stakeV3.getTotalRewardsBalance(stakingUser.address);
    const stakingUserBalance = await aaveToken.balanceOf(stakingUser.address);
    const stakingUserStkBalance = await stakeV3.balanceOf(stakingUser.address);
    const nonStakingUserReward = await stakeV3.getTotalRewardsBalance(nonStakingUser.address);
    const nonStakingUserBalance = await aaveToken.balanceOf(nonStakingUser.address);
    const nonStakingUserStkBalance = await stakeV3.balanceOf(nonStakingUser.address);

    expect(stakingUserBalance).to.be.eq(0);
    expect(stakingUserStkBalance).to.be.eq(parseUnits('100'));
    expect(stakingUserReward).to.be.gt(0);
    expect(nonStakingUserBalance).to.be.eq(parseUnits('100'));
    expect(nonStakingUserStkBalance).to.be.eq(0);
    expect(nonStakingUserReward).to.be.eq(0);

    await stakeV3
      .connect(stakingUser.signer)
      .claimRewardsAndStake(stakingUser.address, MAX_UINT_AMOUNT);

    expect(await stakeV3.getTotalRewardsBalance(stakingUser.address)).to.be.gte(stakingUserReward);
    expect(await stakeV3.getTotalRewardsBalance(nonStakingUser.address)).to.be.eq(0);

    expect(await stakeV3.balanceOf(stakingUser.address)).to.be.eq(
      stakingUserStkBalance,
      'Staking user claimed and staked rewards'
    );
  });

  it('ClaimRewardsAndStakeOnBehalf, expect noop', async () => {
    const {
      aaveToken,
      users: [stakingUser, nonStakingUser],
    } = testEnv;

    await increaseTimeAndMine(64000);

    const stakingUserReward = await stakeV3.getTotalRewardsBalance(stakingUser.address);
    const stakingUserBalance = await aaveToken.balanceOf(stakingUser.address);
    const stakingUserStkBalance = await stakeV3.balanceOf(stakingUser.address);
    const nonStakingUserReward = await stakeV3.getTotalRewardsBalance(nonStakingUser.address);
    const nonStakingUserBalance = await aaveToken.balanceOf(nonStakingUser.address);
    const nonStakingUserStkBalance = await stakeV3.balanceOf(nonStakingUser.address);

    expect(stakingUserBalance).to.be.eq(0);
    expect(stakingUserStkBalance).to.be.eq(parseUnits('100'));
    expect(stakingUserReward).to.be.gt(0);
    expect(nonStakingUserBalance).to.be.eq(parseUnits('100'));
    expect(nonStakingUserStkBalance).to.be.eq(0);
    expect(nonStakingUserReward).to.be.eq(0);

    await stakeV3
      .connect(stakingUser.signer)
      .claimRewardsAndStakeOnBehalf(stakingUser.address, stakingUser.address, MAX_UINT_AMOUNT);

    expect(await stakeV3.getTotalRewardsBalance(stakingUser.address)).to.be.gte(stakingUserReward);
    expect(await stakeV3.getTotalRewardsBalance(nonStakingUser.address)).to.be.eq(0);

    expect(await stakeV3.balanceOf(stakingUser.address)).to.be.eq(
      stakingUserStkBalance,
      'Staking user claimed and staked rewards'
    );

    expect(await aaveToken.balanceOf(stakingUser.address)).to.be.eq(
      stakingUserBalance,
      'Staking user claimed rewards'
    );
  });

  it('ClaimRewardsAndRedeem, expect noop', async () => {
    const {
      aaveToken,
      users: [stakingUser, nonStakingUser],
    } = testEnv;

    await increaseTimeAndMine(64000);

    const stakingUserReward = await stakeV3.getTotalRewardsBalance(stakingUser.address);
    const stakingUserBalance = await aaveToken.balanceOf(stakingUser.address);
    const stakingUserStkBalance = await stakeV3.balanceOf(stakingUser.address);
    const nonStakingUserReward = await stakeV3.getTotalRewardsBalance(nonStakingUser.address);
    const nonStakingUserBalance = await aaveToken.balanceOf(nonStakingUser.address);
    const nonStakingUserStkBalance = await stakeV3.balanceOf(nonStakingUser.address);

    expect(stakingUserBalance).to.be.eq(0);
    expect(stakingUserStkBalance).to.be.eq(parseUnits('100'));
    expect(stakingUserReward).to.be.gt(0);
    expect(nonStakingUserBalance).to.be.eq(parseUnits('100'));
    expect(nonStakingUserStkBalance).to.be.eq(0);
    expect(nonStakingUserReward).to.be.eq(0);

    await stakeV3
      .connect(stakingUser.signer)
      .claimRewardsAndRedeem(stakingUser.address, MAX_UINT_AMOUNT, MAX_UINT_AMOUNT);

    expect(await stakeV3.getTotalRewardsBalance(stakingUser.address)).to.be.gte(stakingUserReward);
    expect(await stakeV3.getTotalRewardsBalance(nonStakingUser.address)).to.be.eq(0);

    expect(await stakeV3.balanceOf(stakingUser.address)).to.be.eq(
      stakingUserStkBalance,
      'Staking user claimed and staked rewards'
    );

    expect(await aaveToken.balanceOf(stakingUser.address)).to.be.eq(
      stakingUserBalance,
      'Staking user claimed rewards'
    );
  });

  it('ClaimRewardsAndRedeemOnBehalf, expect noop', async () => {
    const {
      aaveToken,
      users: [stakingUser, nonStakingUser],
    } = testEnv;

    await increaseTimeAndMine(64000);

    const stakingUserReward = await stakeV3.getTotalRewardsBalance(stakingUser.address);
    const stakingUserBalance = await aaveToken.balanceOf(stakingUser.address);
    const stakingUserStkBalance = await stakeV3.balanceOf(stakingUser.address);
    const nonStakingUserReward = await stakeV3.getTotalRewardsBalance(nonStakingUser.address);
    const nonStakingUserBalance = await aaveToken.balanceOf(nonStakingUser.address);
    const nonStakingUserStkBalance = await stakeV3.balanceOf(nonStakingUser.address);

    expect(stakingUserBalance).to.be.eq(0);
    expect(stakingUserStkBalance).to.be.eq(parseUnits('100'));
    expect(stakingUserReward).to.be.gt(0);
    expect(nonStakingUserBalance).to.be.eq(parseUnits('100'));
    expect(nonStakingUserStkBalance).to.be.eq(0);
    expect(nonStakingUserReward).to.be.eq(0);

    await stakeV3
      .connect(stakingUser.signer)
      .claimRewardsAndRedeemOnBehalf(
        stakingUser.address,
        stakingUser.address,
        MAX_UINT_AMOUNT,
        MAX_UINT_AMOUNT
      );

    expect(await stakeV3.getTotalRewardsBalance(stakingUser.address)).to.be.gte(stakingUserReward);
    expect(await stakeV3.getTotalRewardsBalance(nonStakingUser.address)).to.be.eq(0);

    expect(await stakeV3.balanceOf(stakingUser.address)).to.be.eq(
      stakingUserStkBalance,
      'Staking user claimed and removed stake'
    );

    expect(await aaveToken.balanceOf(stakingUser.address)).to.be.eq(
      stakingUserBalance,
      'Staking user claimed rewards'
    );
  });

  it('Slash', async () => {
    const {
      aaveToken,
      users: [slashingAdmin, auctionModule],
    } = testEnv;

    expect(await stakeV3.getAdmin(SLASHING_ADMIN)).to.be.eq(slashingAdmin.address);

    const stakeBalanceBefore = await aaveToken.balanceOf(stakeV3.address);
    const auctionModuleBalanceBefore = await aaveToken.balanceOf(auctionModule.address);
    const exchangeRate = await stakeV3.exchangeRate();

    await stakeV3.connect(slashingAdmin.signer).slash(auctionModule.address, parseUnits('10'));

    expect(await aaveToken.balanceOf(stakeV3.address)).to.be.eq(
      stakeBalanceBefore.sub(parseUnits('10'))
    );
    expect(await aaveToken.balanceOf(auctionModule.address)).to.be.eq(
      auctionModuleBalanceBefore.add(parseUnits('10'))
    );
    expect(await stakeV3.exchangeRate()).to.be.eq(exchangeRate.mul(9).div(10));
  });
});
