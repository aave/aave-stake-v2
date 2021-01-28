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

  let stakeV3 : StakedAaveV3;

  it('Updates the instance of stakedAave to v3', async () => {
    const {
      stakedAave,
      stakedAaveV2,
      aaveToken,
      users
    } = testEnv;

    const [deployer, rewardsVault] = await getEthersSigners();
  
    const rewardsVaultAddress = (await rewardsVault.getAddress()).toString();
    const emissionManager = await deployer.getAddress();

    stakeV3 = await deployStakedAaveV3(
      [
        aaveToken.address,
        aaveToken.address,
        COOLDOWN_SECONDS,
        UNSTAKE_WINDOW,
        rewardsVaultAddress,
        emissionManager,
        (1000 * 60 * 60).toString(),
      ]);

  });

  it('Verifies that the initial exchange rate is 1:1', async () => {

    const currentExchangeRate = await stakeV3.exchangeRate();

    // Stake token tests
    expect(currentExchangeRate.toString()).to.be.equal(
      WAD
    );
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

    // Stake token tests
    expect(currentExchangeRate.toString()).to.be.equal(
      WAD
    );
  });


});
