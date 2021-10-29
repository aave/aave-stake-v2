import { makeSuite, stakedAaveInitializeTimestamp, TestEnv } from '../helpers/make-suite';
import {
  COOLDOWN_SECONDS,
  UNSTAKE_WINDOW,
  MAX_UINT_AMOUNT,
  AAVE_GOVERNANCE_V2,
  AAVE_TOKEN,
} from '../../helpers/constants';
import {
  waitForTx,
  DRE,
  impersonateAccountsHardhat,
  advanceBlockTo,
  advanceBlock,
} from '../../helpers/misc-utils';
import { getEthersSigners } from '../../helpers/contracts-helpers';
import { deployStakedAaveV3 } from '../../helpers/contracts-accessors';
import { StakedAaveV3 } from '../../types/StakedAaveV3';
import { IBaseAdminUpgradabilityProxy } from '../../types/IBaseAdminUpgradabilityProxy';
import {
  Executor__factory,
  IAaveGovernanceV2,
  IBaseAdminUpgradabilityProxy__factory,
  SelfdestructTransfer__factory,
  StakedAaveV3__factory,
  StakeTokenUpgradeProposalExecutor__factory,
} from '../../types';
import { parseEther } from '@ethersproject/units';
import { expect } from 'chai';
import { ethers } from 'ethers';

const LONG_EXECUTOR = '0x61910EcD7e8e942136CE7Fe7943f956cea1CC2f7';
const STAKED_AAVE_PROXY = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';

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
  let implementation: StakedAaveV3;
  let stakeAaveProxy: IBaseAdminUpgradabilityProxy;
  let stakedAave: StakedAaveV3;
  let stakeAaveProxySigner: ethers.providers.JsonRpcSigner;
  let longExecutorSigner: ethers.providers.JsonRpcSigner;

  before('Setup', async () => {
    await impersonateAccountsHardhat([LONG_EXECUTOR, STAKED_AAVE_PROXY]);

    const user = (await DRE.ethers.getSigners())[0];

    const selfDestruct = await (await new SelfdestructTransfer__factory(user).deploy()).deployed();
    await selfDestruct.connect(user).destroyAndTransfer(LONG_EXECUTOR, { value: parseEther('10') });

    const selfDestruct2 = await (await new SelfdestructTransfer__factory(user).deploy()).deployed();
    await selfDestruct2
      .connect(user)
      .destroyAndTransfer(STAKED_AAVE_PROXY, { value: parseEther('10') });

    longExecutorSigner = DRE.ethers.provider.getSigner(LONG_EXECUTOR);
    stakeAaveProxySigner = DRE.ethers.provider.getSigner(STAKED_AAVE_PROXY);

    stakeAaveProxy = IBaseAdminUpgradabilityProxy__factory.connect(
      STAKED_AAVE_PROXY,
      await DRE.ethers.getSigners()[0]
    );

    stakedAave = StakedAaveV3__factory.connect(STAKED_AAVE_PROXY, await DRE.ethers.getSigners()[0]);
  });

  it('Deploy and init new stake token implementation', async () => {
    const { aaveToken, users } = testEnv;

    const [deployer, rewardsVault] = await getEthersSigners();

    const rewardsVaultAddress = (await rewardsVault.getAddress()).toString();
    const emissionManager = await deployer.getAddress();

    implementation = await deployStakedAaveV3([
      aaveToken.address,
      aaveToken.address,
      COOLDOWN_SECONDS,
      UNSTAKE_WINDOW,
      rewardsVaultAddress,
      emissionManager,
      (10000 * 60 * 60).toString(),
    ]);

    await aaveToken.connect(rewardsVault).approve(implementation.address, MAX_UINT_AMOUNT);

    //initialize the stake instance
    await waitForTx(
      await implementation['initialize(address,address,address,uint256,string,string,uint8)'](
        users[0].address,
        users[1].address,
        users[2].address,
        '2000',
        'Staked AAVE',
        'stkAAVE',
        18
      )
    );
  });

  it('Governance to upgrade contract', async () => {
    const { users, aaveToken } = testEnv;

    const executor = Executor__factory.connect(LONG_EXECUTOR, users[0].signer);

    const realAaveToken = StakedAaveV3__factory.connect(AAVE_TOKEN, users[0].signer);

    const whales = [
      '0x26a78d5b6d7a7aceedd1e6ee3229b372a624d8b7',
      '0x1d4296c4f14cc5edceb206f7634ae05c3bfc3cb7',
      '0x7d439999E63B75618b9C6C69d6EFeD0C2Bc295c8',
    ];

    await impersonateAccountsHardhat(whales);

    const whaleSigners = await Promise.all(
      whales.map(async (whaleAddr) => {
        return DRE.ethers.provider.getSigner(whaleAddr);
      })
    );

    await users[0].signer.sendTransaction({ to: whales[0], value: parseEther('10') });
    await users[0].signer.sendTransaction({ to: whales[1], value: parseEther('10') });
    await users[0].signer.sendTransaction({ to: whales[2], value: parseEther('10') });

    await realAaveToken.connect(stakeAaveProxySigner).delegate(whales[0]);
    await realAaveToken.connect(whaleSigners[1]).delegate(whales[0]);
    await realAaveToken.connect(whaleSigners[2]).delegate(whales[0]);

    const gov = (await DRE.ethers.getContractAt(
      'IAaveGovernanceV2',
      AAVE_GOVERNANCE_V2
    )) as IAaveGovernanceV2;

    const proposalPayload = await (
      await new StakeTokenUpgradeProposalExecutor__factory(whaleSigners[0]).deploy(
        implementation.address
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

    const addressBeforeUpgrade = await stakeAaveProxy
      .connect(longExecutorSigner)
      .callStatic.implementation({ from: longExecutorSigner._address });

    await gov.connect(whaleSigners[0]).execute(proposalId);

    const addressAfterUpgrade = await stakeAaveProxy
      .connect(longExecutorSigner)
      .callStatic.implementation({ from: longExecutorSigner._address });

    expect(addressBeforeUpgrade).to.not.be.eq(implementation.address);
    expect(addressAfterUpgrade).to.be.eq(implementation.address);

    expect(await gov.getProposalState(proposalId)).to.be.eq(proposalStates.EXECUTED);
  });

  it.skip('Upgrade contract without governance', async () => {
    const addressBeforeUpgrade = await stakeAaveProxy
      .connect(longExecutorSigner)
      .callStatic.implementation({ from: longExecutorSigner._address });

    expect(addressBeforeUpgrade).to.not.be.eq(implementation.address);

    await waitForTx(
      await stakeAaveProxy.connect(longExecutorSigner).upgradeTo(implementation.address)
    );

    expect(
      await stakeAaveProxy
        .connect(longExecutorSigner)
        .callStatic.implementation({ from: longExecutorSigner._address })
    ).to.be.eq(implementation.address);
  });

  it('Read emergency shutdown value only in updated contract', async () => {
    const {
      users: [, , , , user],
    } = testEnv;

    expect(await stakedAave.connect(user.signer).getEmergencyShutdown()).to.be.eq(false);
  });
});
