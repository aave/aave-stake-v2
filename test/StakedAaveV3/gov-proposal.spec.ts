import { makeSuite, TestEnv } from '../helpers/make-suite';
import {
  MAX_UINT_AMOUNT,
  AAVE_GOVERNANCE_V2,
  AAVE_TOKEN,
  SHORT_EXECUTOR,
  LONG_EXECUTOR,
  getCooldownSecondsPerNetwork,
  getUnstakeWindowPerNetwork,
} from '../../helpers/constants';
import {
  waitForTx,
  DRE,
  impersonateAccountsHardhat,
  advanceBlockTo,
  advanceBlock,
} from '../../helpers/misc-utils';
import { getEthersSigners } from '../../helpers/contracts-helpers';
import { StakedAaveV3 } from '../../types/StakedAaveV3';
import { IBaseAdminUpgradabilityProxy } from '../../types/IBaseAdminUpgradabilityProxy';
import {
  Executor__factory,
  IAaveGovernanceV2,
  IBaseAdminUpgradabilityProxy__factory,
  Ierc20,
  Ierc20__factory,
  SelfdestructTransfer__factory,
  StakedAaveV3__factory,
  StakedAbptV3,
  StakeTokenUpgradeProposalExecutor__factory,
} from '../../types';
import { formatUnits, parseEther, parseUnits } from '@ethersproject/units';
import { expect } from 'chai';
import { ethers } from 'ethers';
import { getRewards } from '../DistributionManager/data-helpers/base-math';
import { eEthereumNetwork } from '../../helpers/types';
import { StakedBptV3__factory } from '../../types/factories/StakedBptV3__factory';

const STAKED_AAVE_PROXY = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';
const STAKED_ABPT_PROXY = '0xa1116930326D21fB917d5A27F1E9943A9595fb47';
const AAVE_BALANCER_POOL_TOKEN = '0x41A08648C3766F9F9d85598fF102a08f4ef84F84';
const ABPT_HOLDER = '0xfC15E7Ef48a4224A85798551cC7b39dfbC93ad1e';

const proposalStates = {
  PENDING: 0,
  CANCELED: 1,
  ACTIVE: 2,
  FAILED: 3,
  SUCCEEDED: 4,
  QUEUED: 5,
  EXPIRED: 6,
  EXECUTED: 7,
};

makeSuite('Governance proposal for updating staked aave', (testEnv: TestEnv) => {
  let stakedAaveImplementation: StakedAaveV3;
  let stakedAaveProxy: IBaseAdminUpgradabilityProxy;
  let stakedAave: StakedAaveV3;
  let stakedAbptImplementation: StakedAbptV3;
  let stakedAbptProxy: IBaseAdminUpgradabilityProxy;
  let stakedAbpt: StakedAbptV3;
  let stakedAaveProxySigner: ethers.providers.JsonRpcSigner;
  let longExecutorSigner: ethers.providers.JsonRpcSigner;

  let abpt: Ierc20;
  let aaveToken: StakedAaveV3;
  let stakedAaveAssetDataBeforeUpdate;
  let stakedAbptAssetDataBeforeUpdate;

  const COOLDOWN_SECONDS = getCooldownSecondsPerNetwork(eEthereumNetwork.main);
  const UNSTAKE_WINDOW = getUnstakeWindowPerNetwork(eEthereumNetwork.main);

  let abptSigner: ethers.providers.JsonRpcSigner;

  before('Setup', async () => {
    await impersonateAccountsHardhat([LONG_EXECUTOR, STAKED_AAVE_PROXY, ABPT_HOLDER]);

    const user = (await DRE.ethers.getSigners())[0];

    const selfDestruct = await (await new SelfdestructTransfer__factory(user).deploy()).deployed();
    await selfDestruct.connect(user).destroyAndTransfer(LONG_EXECUTOR, { value: parseEther('10') });

    const selfDestruct2 = await (await new SelfdestructTransfer__factory(user).deploy()).deployed();
    await selfDestruct2
      .connect(user)
      .destroyAndTransfer(STAKED_AAVE_PROXY, { value: parseEther('10') });

    longExecutorSigner = DRE.ethers.provider.getSigner(LONG_EXECUTOR);
    stakedAaveProxySigner = DRE.ethers.provider.getSigner(STAKED_AAVE_PROXY);
    abptSigner = DRE.ethers.provider.getSigner(ABPT_HOLDER);

    stakedAaveProxy = IBaseAdminUpgradabilityProxy__factory.connect(
      STAKED_AAVE_PROXY,
      await DRE.ethers.getSigners()[0]
    );
    stakedAbptProxy = IBaseAdminUpgradabilityProxy__factory.connect(
      STAKED_ABPT_PROXY,
      await DRE.ethers.getSigners()[0]
    );

    aaveToken = StakedAaveV3__factory.connect(AAVE_TOKEN, await DRE.ethers.getSigners()[0]);
    abpt = Ierc20__factory.connect(AAVE_BALANCER_POOL_TOKEN, await DRE.ethers.getSigners()[0]);
    stakedAave = StakedAaveV3__factory.connect(STAKED_AAVE_PROXY, await DRE.ethers.getSigners()[0]);
    stakedAbpt = StakedBptV3__factory.connect(STAKED_ABPT_PROXY, await DRE.ethers.getSigners()[0]);
  });

  it('User stakes aave before upgrade', async () => {
    const {
      users: [, , , user3],
    } = testEnv;

    const binanceAddress = '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8';
    await impersonateAccountsHardhat([binanceAddress]);
    const binanceSigner = DRE.ethers.provider.getSigner(binanceAddress);

    await aaveToken.connect(binanceSigner).transfer(user3.address, parseUnits('100'));
    await aaveToken.connect(user3.signer).approve(stakedAave.address, MAX_UINT_AMOUNT);
    await stakedAave.connect(user3.signer).stake(user3.address, parseUnits('100'));
  });

  it('User stakes aave balance pool token before upgrade', async () => {
    const {
      users: [, , , , user4],
    } = testEnv;

    await user4.signer.sendTransaction({ to: abptSigner._address, value: parseEther('10') });

    await abpt.connect(abptSigner).approve(stakedAbpt.address, MAX_UINT_AMOUNT);
    await stakedAbpt.connect(abptSigner).stake(abptSigner._address, parseUnits('100'));
  });

  it('Deploy and init new stake aave token implementation', async () => {
    const [deployer] = await getEthersSigners();

    const rewardsVaultAddress = await stakedAave.connect(deployer).REWARDS_VAULT();
    const emissionManager = await stakedAave.connect(deployer).EMISSION_MANAGER();

    stakedAaveImplementation = await (
      await new StakedAaveV3__factory(deployer).deploy(
        aaveToken.address,
        aaveToken.address,
        COOLDOWN_SECONDS,
        UNSTAKE_WINDOW,
        rewardsVaultAddress,
        emissionManager,
        (10000 * 60 * 60).toString(),
        AAVE_GOVERNANCE_V2
      )
    ).deployed();

    await waitForTx(
      await stakedAaveImplementation[
        'initialize(address,address,address,uint256,string,string,uint8)'
      ](SHORT_EXECUTOR, SHORT_EXECUTOR, SHORT_EXECUTOR, '3000', 'Staked AAVE', 'stkAAVE', 18)
    );
  });

  it('Deploy and init new stake aave balance pool token implementation', async () => {
    const [deployer] = await getEthersSigners();

    const rewardsVaultAddress = await stakedAave.connect(deployer).REWARDS_VAULT();
    const emissionManager = await stakedAave.connect(deployer).EMISSION_MANAGER();

    stakedAbptImplementation = await (
      await new StakedBptV3__factory(deployer).deploy(
        AAVE_BALANCER_POOL_TOKEN,
        aaveToken.address,
        COOLDOWN_SECONDS,
        UNSTAKE_WINDOW,
        rewardsVaultAddress,
        emissionManager,
        (10000 * 60 * 60).toString(),
        AAVE_GOVERNANCE_V2
      )
    ).deployed();

    await waitForTx(
      await stakedAbptImplementation[
        'initialize(address,address,address,uint256,string,string,uint8)'
      ](
        SHORT_EXECUTOR,
        SHORT_EXECUTOR,
        SHORT_EXECUTOR,
        '3000',
        'Staked Aave Balance Pool Token',
        'stkABPT',
        18
      )
    );
  });

  it('Fetch state before upgrade', async () => {
    const { deployer } = testEnv;
    stakedAaveAssetDataBeforeUpdate = await stakedAave
      .connect(deployer.signer)
      .assets(stakedAave.address);
    stakedAbptAssetDataBeforeUpdate = await stakedAbpt
      .connect(deployer.signer)
      .assets(stakedAbpt.address);
  });

  it('Governance proposal to upgrade contract', async () => {
    const { users } = testEnv;

    const executor = Executor__factory.connect(LONG_EXECUTOR, users[0].signer);

    const whales = [
      '0x26a78d5b6d7a7aceedd1e6ee3229b372a624d8b7',
      '0x1d4296c4f14cc5edceb206f7634ae05c3bfc3cb7',
      '0x7d439999E63B75618b9C6C69d6EFeD0C2Bc295c8',
    ];

    await impersonateAccountsHardhat(whales);

    const whaleSigners = whales.map((whaleAddr) => {
      return DRE.ethers.provider.getSigner(whaleAddr);
    });

    await users[0].signer.sendTransaction({ to: whales[0], value: parseEther('10') });
    await users[0].signer.sendTransaction({ to: whales[1], value: parseEther('10') });
    await users[0].signer.sendTransaction({ to: whales[2], value: parseEther('10') });

    await aaveToken.connect(stakedAaveProxySigner).delegate(whales[0]);
    await aaveToken.connect(whaleSigners[1]).delegate(whales[0]);
    await aaveToken.connect(whaleSigners[2]).delegate(whales[0]);

    const gov = (await DRE.ethers.getContractAt(
      'IAaveGovernanceV2',
      AAVE_GOVERNANCE_V2
    )) as IAaveGovernanceV2;

    const proposalPayload = await (
      await new StakeTokenUpgradeProposalExecutor__factory(whaleSigners[0]).deploy(
        stakedAaveImplementation.address,
        stakedAbptImplementation.address
      )
    ).deployed();

    const populated = await proposalPayload.populateTransaction.execute();
    const calldata = populated.data ? populated.data : '0x';
    const proposalId = await gov.getProposalsCount();

    await gov
      .connect(whaleSigners[0])
      .create(
        LONG_EXECUTOR,
        [proposalPayload.address],
        [0],
        [''],
        [calldata],
        [true],
        '0xf7a1f565fcd7684fba6fea5d77c5e699653e21cb6ae25fbf8c5dbc8d694c7949'
      );

    const proposal = await gov.getProposalById(proposalId);

    const votingDelay = await gov.getVotingDelay();
    const votingPeriod = await executor.VOTING_DURATION();
    const startblock = proposal.startBlock.add(votingDelay);
    const endblock = startblock.add(votingPeriod);

    await advanceBlockTo(Number(startblock.add(1).toString()));
    expect(await gov.getProposalState(proposalId)).to.be.eq(proposalStates.ACTIVE);

    await gov.connect(whaleSigners[0]).submitVote(proposalId, true);

    await advanceBlockTo(Number(endblock.add(1).toString()));
    expect(await gov.getProposalState(proposalId)).to.be.eq(proposalStates.SUCCEEDED);

    await gov.connect(whaleSigners[0]).queue(proposalId);
    expect(await gov.getProposalState(proposalId)).to.be.eq(proposalStates.QUEUED);

    const executionTime = (await gov.getProposalById(proposalId)).executionTime;
    await advanceBlock(executionTime.toNumber());

    const stakedAaveImplAddressBeforeUpgrade = await stakedAaveProxy
      .connect(longExecutorSigner)
      .callStatic.implementation({ from: longExecutorSigner._address });
    const stakedAbptImplAddressBeforeUpgrade = await stakedAbptProxy
      .connect(longExecutorSigner)
      .callStatic.implementation({ from: longExecutorSigner._address });

    await gov.connect(whaleSigners[0]).execute(proposalId);

    const stakedAaveImplAddressAfterUpgrade = await stakedAaveProxy
      .connect(longExecutorSigner)
      .callStatic.implementation({ from: longExecutorSigner._address });
    const stakedAbptImplAddressAfterUpgrade = await stakedAbptProxy
      .connect(longExecutorSigner)
      .callStatic.implementation({ from: longExecutorSigner._address });

    expect(stakedAaveImplAddressBeforeUpgrade).to.not.be.eq(stakedAaveImplementation.address);
    expect(stakedAaveImplAddressAfterUpgrade).to.be.eq(stakedAaveImplementation.address);
    expect(stakedAbptImplAddressBeforeUpgrade).to.not.be.eq(stakedAbptImplementation.address);
    expect(stakedAbptImplAddressAfterUpgrade).to.be.eq(stakedAbptImplementation.address);

    expect(await gov.getProposalState(proposalId)).to.be.eq(proposalStates.EXECUTED);
  });

  it.skip('Upgrade contracts by impersonating executor', async () => {
    // Upgrade stakeAave
    const stakedAaveImplementationAddressBeforeUpgrade = await stakedAaveProxy
      .connect(longExecutorSigner)
      .callStatic.implementation({ from: longExecutorSigner._address });

    expect(stakedAaveImplementationAddressBeforeUpgrade).to.not.be.eq(
      stakedAaveImplementation.address
    );

    const populatedAaveTx = await stakedAave.populateTransaction[
      'initialize(address,address,address,uint256,string,string,uint8)'
    ](SHORT_EXECUTOR, SHORT_EXECUTOR, SHORT_EXECUTOR, 3000, 'Staked AAVE', 'stkAAVE', 18);
    const aaveCalldata = populatedAaveTx.data ? populatedAaveTx.data : '0x';

    await waitForTx(
      await stakedAaveProxy
        .connect(longExecutorSigner)
        .upgradeToAndCall(stakedAaveImplementation.address, aaveCalldata)
    );

    expect(
      await stakedAaveProxy
        .connect(longExecutorSigner)
        .callStatic.implementation({ from: longExecutorSigner._address })
    ).to.be.eq(stakedAaveImplementation.address);

    // Upgrade staked balancer pool
    const stakedBptImplementationAddressBeforeUpgrade = await stakedAbptProxy
      .connect(longExecutorSigner)
      .callStatic.implementation({ from: longExecutorSigner._address });

    expect(stakedBptImplementationAddressBeforeUpgrade).to.not.be.eq(
      stakedAbptImplementation.address
    );

    const populatedBptTx = await stakedAbpt.populateTransaction[
      'initialize(address,address,address,uint256,string,string,uint8)'
    ](
      SHORT_EXECUTOR,
      SHORT_EXECUTOR,
      SHORT_EXECUTOR,
      '3000',
      'Staked Aave Balance Pool Token',
      'stkABPT',
      18
    );
    const abptCalldata = populatedBptTx.data ? populatedBptTx.data : '0x';

    await waitForTx(
      await stakedAbptProxy
        .connect(longExecutorSigner)
        .upgradeToAndCall(stakedAbptImplementation.address, abptCalldata)
    );

    expect(
      await stakedAbptProxy
        .connect(longExecutorSigner)
        .callStatic.implementation({ from: longExecutorSigner._address })
    ).to.be.eq(stakedAbptImplementation.address);
  });

  it('Read values only in updated contract', async () => {
    const {
      users: [, , , , user],
    } = testEnv;

    // Staked aave
    expect(await stakedAave.connect(user.signer).getEmergencyShutdown()).to.be.eq(false);
    const slashingAdminAave = await stakedAave
      .connect(user.signer)
      .getAdmin(await stakedAave.connect(user.signer).SLASH_ADMIN_ROLE());
    expect(slashingAdminAave).to.be.eq(SHORT_EXECUTOR);

    // Staked balancer pool
    expect(await stakedAbpt.connect(user.signer).getEmergencyShutdown()).to.be.eq(false);
    const slashingAdminAbpt = await stakedAave
      .connect(user.signer)
      .getAdmin(await stakedAbpt.connect(user.signer).SLASH_ADMIN_ROLE());
    expect(slashingAdminAbpt).to.be.eq(SHORT_EXECUTOR);
  });

  // We need to take a look at the emissions
  it('Check that emissions match after upgrade', async () => {
    const { deployer } = testEnv;
    const stakedAaveAssetData = await stakedAave
      .connect(deployer.signer)
      .assets(stakedAave.address);

    expect(stakedAaveAssetData.lastUpdateTimestamp).to.be.eq(
      stakedAaveAssetDataBeforeUpdate.lastUpdateTimestamp
    );
    expect(stakedAaveAssetData.index).to.be.eq(stakedAaveAssetDataBeforeUpdate.index);
    expect(stakedAaveAssetData.emissionPerSecond).to.be.eq(
      stakedAaveAssetDataBeforeUpdate.emissionPerSecond
    );
  });

  it('Check that balance pool emisisons match after upgrade', async () => {
    const { deployer } = testEnv;

    const stakedAbpAssetData = await stakedAbpt.connect(deployer.signer).assets(stakedAbpt.address);
    expect(stakedAbpAssetData.lastUpdateTimestamp).to.be.eq(
      stakedAbptAssetDataBeforeUpdate.lastUpdateTimestamp
    );
    expect(stakedAbpAssetData.index).to.be.eq(stakedAbptAssetDataBeforeUpdate.index);
    expect(stakedAbpAssetData.emissionPerSecond).to.be.eq(
      stakedAbptAssetDataBeforeUpdate.emissionPerSecond
    );
  });

  it('Check accrual after update of staked aave token', async () => {
    const {
      users: [, , , user3],
    } = testEnv;
    const userBalance = await stakedAave.connect(user3.signer).balanceOf(user3.address);
    const userIndex = await stakedAave
      .connect(user3.signer)
      .getUserAssetData(user3.address, stakedAave.address);

    const aaveBalanceBefore = await aaveToken.connect(user3.signer).balanceOf(user3.address);
    const alreadyClaimable = await stakedAave
      .connect(user3.signer)
      .stakerRewardsToClaim(user3.address);

    await stakedAave.connect(user3.signer).claimRewards(user3.address, MAX_UINT_AMOUNT);

    const indexFinal = (await stakedAave.connect(user3.signer).assets(stakedAave.address)).index;
    const expectedRewards = alreadyClaimable.add(getRewards(userBalance, indexFinal, userIndex));

    expect(await aaveToken.connect(user3.signer).balanceOf(user3.address)).to.be.eq(
      aaveBalanceBefore.add(expectedRewards)
    );
    expect(await aaveToken.connect(user3.signer).balanceOf(user3.address)).to.be.gt(
      aaveBalanceBefore
    );
  });

  it('Check accrual after update of staked aave balance pool token', async () => {
    const userBalance = await stakedAbpt.connect(abptSigner).balanceOf(abptSigner._address);
    const userIndex = await stakedAbpt
      .connect(abptSigner)
      .getUserAssetData(abptSigner._address, stakedAbpt.address);

    const aaveBalanceBefore = await aaveToken.connect(abptSigner).balanceOf(abptSigner._address);
    const alreadyClaimable = await stakedAbpt
      .connect(abptSigner)
      .stakerRewardsToClaim(abptSigner._address);

    await stakedAbpt.connect(abptSigner).claimRewards(abptSigner._address, MAX_UINT_AMOUNT);

    const indexFinal = (await stakedAbpt.connect(abptSigner).assets(stakedAbpt.address)).index;
    const expectedRewards = alreadyClaimable.add(getRewards(userBalance, indexFinal, userIndex));

    expect(await aaveToken.connect(abptSigner).balanceOf(abptSigner._address)).to.be.eq(
      aaveBalanceBefore.add(expectedRewards)
    );
    expect(await aaveToken.connect(abptSigner).balanceOf(abptSigner._address)).to.be.gt(
      aaveBalanceBefore
    );
  });
});
