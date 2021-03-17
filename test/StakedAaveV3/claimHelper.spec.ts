import { makeSuite, TestEnv } from '../helpers/make-suite';
import {
  COOLDOWN_SECONDS,
  UNSTAKE_WINDOW,
  MAX_UINT_AMOUNT,
  SHORT_EXECUTOR,
  WAD,
} from '../../helpers/constants';
import {
  waitForTx,
  timeLatest,
  advanceBlock,
  increaseTimeAndMine,
  DRE,
  evmRevert,
  evmSnapshot,
} from '../../helpers/misc-utils';
import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import {
  buildPermitParams,
  getContract,
  getEthersSigners,
  getSignatureFromTypedData,
} from '../../helpers/contracts-helpers';
import {
  deployClaimHelper,
  deployStakedAaveV3,
  getStakedAaveProxy,
} from '../../helpers/contracts-accessors';
import { StakedTokenV3 } from '../../types/StakedTokenV3';
import { StakedAaveV3 } from '../../types/StakedAaveV3';
import { getUserIndex } from '../DistributionManager/data-helpers/asset-user-data';
import { getRewards } from '../DistributionManager/data-helpers/base-math';
import { compareRewardsAtAction } from '../StakedAaveV2/data-helpers/reward';
import { fail } from 'assert';
import { parseEther } from 'ethers/lib/utils';
import { ClaimStakingRewardsHelper } from '../../types';

const { expect } = require('chai');

const SLASHING_ADMIN = 0;
const COOLDOWN_ADMIN = 1;
const CLAIM_HELPER_ROLE = 2;

makeSuite('StakedAave V3 Claim Helper', (testEnv: TestEnv) => {
  let stakeAaveV3: StakedAaveV3;
  let stakeAave2V3: StakedAaveV3;
  let claimHelper: ClaimStakingRewardsHelper;
  let snap: string;
  // it('Deploys 2 stake tokens with claimHelper address', async () => {
  beforeEach(async () => {
    const { aaveToken, users } = testEnv;

    const [deployer, rewardsVault] = await getEthersSigners();

    const rewardsVaultAddress = (await rewardsVault.getAddress()).toString();
    const emissionManager = await deployer.getAddress();

    stakeAaveV3 = await deployStakedAaveV3([
      aaveToken.address,
      aaveToken.address,
      COOLDOWN_SECONDS,
      UNSTAKE_WINDOW,
      rewardsVaultAddress,
      emissionManager,
      (1000 * 60 * 60).toString(),
    ]);

    stakeAave2V3 = await deployStakedAaveV3([
      aaveToken.address,
      aaveToken.address,
      COOLDOWN_SECONDS,
      UNSTAKE_WINDOW,
      rewardsVaultAddress,
      emissionManager,
      (1000 * 60 * 60).toString(),
    ]);

    await aaveToken.connect(rewardsVault).approve(stakeAaveV3.address, MAX_UINT_AMOUNT);
    await aaveToken.connect(rewardsVault).approve(stakeAave2V3.address, MAX_UINT_AMOUNT);

    // deploy claim helper contract
    claimHelper = await deployClaimHelper(
      [stakeAaveV3.address, stakeAave2V3.address, aaveToken.address],
      false
    );

    //initialize the stake instance

    await stakeAaveV3['initialize(address,address,address,uint256,string,string,uint8)'](
      users[0].address,
      users[1].address,
      claimHelper.address,
      '2000',
      'Staked AAVE',
      'stkAAVE',
      18
    );
    await stakeAave2V3['initialize(address,address,address,uint256,string,string,uint8)'](
      users[0].address,
      users[1].address,
      claimHelper.address,
      '2000',
      'Staked AAVE',
      'stkAAVE',
      18
    );

    await waitForTx(
      await stakeAaveV3.connect(deployer).configureAssets([
        {
          emissionPerSecond: parseEther('0.001').toString(),
          totalStaked: parseEther('0').toString(),
          underlyingAsset: stakeAaveV3.address,
        },
      ])
    );

    await waitForTx(
      await stakeAave2V3.connect(deployer).configureAssets([
        {
          emissionPerSecond: parseEther('0.001').toString(),
          totalStaked: parseEther('0').toString(),
          underlyingAsset: stakeAave2V3.address,
        },
      ])
    );
    const slashingAdmin = await stakeAaveV3.getAdmin(SLASHING_ADMIN); //slash admin
    const cooldownAdmin = await stakeAaveV3.getAdmin(COOLDOWN_ADMIN); //cooldown admin
    const claimAdmin = await stakeAave2V3.getAdmin(CLAIM_HELPER_ROLE); //claim admin // helper contract
    const slashingAdmin2 = await stakeAave2V3.getAdmin(SLASHING_ADMIN); //slash admin
    const cooldownAdmin2 = await stakeAave2V3.getAdmin(COOLDOWN_ADMIN); //cooldown admin
    const claimAdmin2 = await stakeAave2V3.getAdmin(CLAIM_HELPER_ROLE); //claim admin // helper contract

    expect(slashingAdmin).to.be.equal(users[0].address);
    expect(cooldownAdmin).to.be.equal(users[1].address);
    expect(claimAdmin).to.be.equal(claimHelper.address);
    expect(slashingAdmin2).to.be.equal(users[0].address);
    expect(cooldownAdmin2).to.be.equal(users[1].address);
    expect(claimAdmin2).to.be.equal(claimHelper.address);
  });
  it('Claims all rewards from both stakes', async () => {
    const {
      aaveToken,
      users: [, , , , staker],
    } = testEnv;
    const amount = ethers.utils.parseEther('10');

    // Prepare actions for the test case
    await aaveToken.connect(staker.signer).approve(stakeAaveV3.address, amount);
    await aaveToken.connect(staker.signer).approve(stakeAave2V3.address, amount);

    await stakeAaveV3.connect(staker.signer).stake(staker.address, amount);
    await stakeAave2V3.connect(staker.signer).stake(staker.address, amount);

    const userAaveBalance = await aaveToken.balanceOf(staker.address);

    const stakeBalance = await stakeAaveV3.balanceOf(staker.address);
    const stakeBalance2 = await stakeAave2V3.balanceOf(staker.address);

    // Increase time for bigger rewards
    await increaseTimeAndMine(1000);

    // user1 claims all
    const userIndexBefore = await getUserIndex(stakeAaveV3, staker.address, aaveToken.address);
    const userIndexBefore2 = await getUserIndex(stakeAave2V3, staker.address, aaveToken.address);

    await claimHelper
      .connect(staker.signer)
      .claimAllRewards(staker.address, ethers.constants.MaxUint256.toString());

    const userIndexAfter = await getUserIndex(stakeAaveV3, staker.address, stakeAaveV3.address);
    const userIndexAfter2 = await getUserIndex(stakeAave2V3, staker.address, stakeAave2V3.address);

    const expectedAccruedRewards = getRewards(
      stakeBalance,
      userIndexAfter,
      userIndexBefore
    ).toString();

    const expectedAccruedRewards2 = getRewards(
      stakeBalance2,
      userIndexAfter2,
      userIndexBefore2
    ).toString();
    console.log('expected accrued rewards2: ', expectedAccruedRewards2.toString());

    const userBalanceAfterActions = await aaveToken.balanceOf(staker.address);

    // console.log('balance total: ', saveUserBalance.add(rewards.add(rewards2)).toString());
    expect(userBalanceAfterActions).to.be.equal(
      userAaveBalance.add(expectedAccruedRewards).add(expectedAccruedRewards2).toString()
    );
  });
  it('Claims all rewards from both stakes and stakes claimed amount', async () => {
    const {
      aaveToken,
      users: [, staker],
    } = testEnv;
    const amount = ethers.utils.parseEther('10');

    // Prepare actions for the test case
    await aaveToken.connect(staker.signer).approve(stakeAaveV3.address, amount);
    await aaveToken.connect(staker.signer).approve(stakeAave2V3.address, amount);

    await stakeAaveV3.connect(staker.signer).stake(staker.address, amount);
    await stakeAave2V3.connect(staker.signer).stake(staker.address, amount);

    // Increase time for bigger rewards
    await increaseTimeAndMine(1000);

    const saveUserBalance = await aaveToken.balanceOf(staker.address);

    const stakeBalance = await stakeAaveV3.balanceOf(staker.address);
    const stakeBalance2 = await stakeAave2V3.balanceOf(staker.address);

    const userIndexBefore = await getUserIndex(stakeAaveV3, staker.address, aaveToken.address);
    const userIndexBefore2 = await getUserIndex(stakeAave2V3, staker.address, aaveToken.address);

    // claim and stake
    await claimHelper
      .connect(staker.signer)
      .claimAllRewardsAndStake(staker.address, ethers.constants.MaxUint256.toString());

    const userIndexAfter = await getUserIndex(stakeAaveV3, staker.address, stakeAaveV3.address);
    const userIndexAfter2 = await getUserIndex(stakeAave2V3, staker.address, stakeAave2V3.address);

    const expectedAccruedRewards = getRewards(
      stakeBalance,
      userIndexAfter,
      userIndexBefore
    ).toString();

    const expectedAccruedRewards2 = getRewards(
      stakeBalance2,
      userIndexAfter2,
      userIndexBefore2
    ).toString();

    // current state
    const userBalanceAfterActions = await aaveToken.balanceOf(staker.address);

    const stakeBalanceAfter = await stakeAaveV3.balanceOf(staker.address);

    expect(userBalanceAfterActions).to.be.equal(saveUserBalance);
    expect(stakeBalanceAfter).to.be.gt(stakeBalance.add(expectedAccruedRewards));
    expect(stakeBalanceAfter).to.be.lte(
      stakeBalance.add(expectedAccruedRewards).add(expectedAccruedRewards2)
    );
  });
});
