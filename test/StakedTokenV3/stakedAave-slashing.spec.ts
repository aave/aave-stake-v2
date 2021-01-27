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
import { deployStakedTokenV3, getStakedAaveProxy } from '../../helpers/contracts-accessors';
import { StakedTokenV3 } from '../../types/StakedTokenV3';

const { expect } = require('chai');

makeSuite('StakedAave V3 slashing tests', (testEnv: TestEnv) => {

  let stakeV3 : StakedTokenV3;

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

    const v3Impl = await deployStakedTokenV3(
      [
        aaveToken.address,
        aaveToken.address,
        COOLDOWN_SECONDS,
        UNSTAKE_WINDOW,
        rewardsVaultAddress,
        emissionManager,
        (1000 * 60 * 60).toString(),
      ]);

    const proxy = await getStakedAaveProxy(stakedAave.address);

    console.log("Staked aave address: ", stakedAave.address, "stakedAaveV2 address: ", stakedAaveV2.address )

    console.log("Encoding...");

    const encodedInitializeV3 = v3Impl.interface.encodeFunctionData('initialize', [
      users[0].address,
      users[1].address
    ]);

    console.log("Encoded.");
    
    stakeV3 = await getContract<StakedTokenV3>(eContractid.StakedTokenV3, stakedAave.address);
    
    await waitForTx(
      await proxy.upgradeToAndCall(
        v3Impl.address,
        encodedInitializeV3
      )
    );    

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
      stakedAaveV2,
      aaveToken,
      users: [, staker],
    } = testEnv;
    const amount = ethers.utils.parseEther('50');

    await aaveToken.connect(staker.signer).approve(stakedAaveV2.address, amount);
    await stakeV3.connect(staker.signer).stake(staker.address, amount);
    
    const currentExchangeRate = await stakeV3.exchangeRate();

    // Stake token tests
    expect(currentExchangeRate.toString()).to.be.equal(
      WAD
    );
  });


});
