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
import { compareRewardsAtAction } from './data-helpers/reward';
import { getUserIndex } from '../DistributionManager/data-helpers/asset-user-data';
import { getRewards } from '../DistributionManager/data-helpers/base-math';
import { logAaveTokenBalanceOf } from './data-helpers/loggers';

const { expect } = require('chai');

makeSuite('StakedAave V2 slashing tests', (testEnv: TestEnv) => {
  it('Verifies that the initial exchange rate is 1:1', async () => {
    const {
      stakedAaveV2
    } = testEnv;

    const currentExchangeRate = await stakedAaveV2.exchangeRate();

    // Stake token tests
    expect(currentExchangeRate.toString()).to.be.equal(
      WAD
    );
  });

  it('Verifies that after a deposit the initial exchange rate is still 1:1', async () => {
    const {
      stakedAaveV2,
      aaveToken,
      users: [, staker],
    } = testEnv;
    const amount = ethers.utils.parseEther('50');

    // Prepare actions for the test case
    const actions = () => [
      aaveToken.connect(staker.signer).approve(stakedAaveV2.address, amount),
      stakedAaveV2.connect(staker.signer).stake(staker.address, amount),
    ];

    // Check rewards
    await compareRewardsAtAction(stakedAaveV2, staker.address, actions);

    const currentExchangeRate = await stakedAaveV2.exchangeRate();

    // Stake token tests
    expect(currentExchangeRate.toString()).to.be.equal(
      WAD
    );
  });


});
