import { task } from 'hardhat/config';
import {
  Erc20__factory,
  IAaveGovernanceV2,
  IDelegationAwareToken__factory,
  SelfdestructTransfer__factory,
  StakedAaveV2__factory,
} from '../../types';
import {
  advanceBlockTo,
  DRE,
  increaseTimeAndMine,
  increaseTimeTenderly,
  latestBlock,
  timeLatest,
  waitForTx,
} from '../../helpers/misc-utils';
import { logError } from '../../helpers/tenderly-utils';
import { parseEther, formatEther } from 'ethers/lib/utils';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import { Signer } from '@ethersproject/abstract-signer';
import { COOLDOWN_SECONDS, MAX_UINT_AMOUNT, REWARDS_VAULT } from '../../helpers/constants';
import { tEthereumAddress } from '../../helpers/types';

task('exec-stks:tenderly', 'Execute staking extension proposal at Tenderly fork')
  .addFlag('defender')
  .setAction(async ({ defender }, localBRE: any) => {
    await localBRE.run('set-dre');

    let proposer: Signer;

    [proposer] = await DRE.ethers.getSigners();

    if (defender) {
      const { signer } = await getDefenderRelaySigner();
      proposer = signer;
    }

    const {
      AAVE_TOKEN = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
      AAVE_GOVERNANCE_V2 = '0xEC568fffba86c094cf06b22134B23074DFE2252c', // mainnet
      AAVE_LONG_EXECUTOR = '0x61910ecd7e8e942136ce7fe7943f956cea1cc2f7', // mainnet
    } = process.env;

    if (!AAVE_TOKEN || !AAVE_GOVERNANCE_V2 || !AAVE_LONG_EXECUTOR) {
      throw new Error('You have not set correctly the .env file, make sure to read the README.md');
    }

    const VOTING_DURATION = 64000;

    const AAVE_WHALE = '0x25f2226b597e8f9514b3f68f00f494cf4f286491';
    const AAVE_WHALE_2 = '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8';

    const AAVE_STAKE = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';
    const STK_BPT_STAKE = '0xa1116930326D21fB917d5A27F1E9943A9595fb47';

    const ethers = DRE.ethers;

    const top10stkAaveHolders = [
      '0x4a49985b14bd0ce42c25efde5d8c379a48ab02f3',
      '0xdd709cae362972cb3b92dcead77127f7b8d58202',
      '0x9b5ea8c719e29a5bd0959faf79c9e5c8206d0499',
      '0xdb5aa12ad695ef2a28c6cdb69f2bb04bed20a48e',
      '0xc4a936b003bc223df757b35ee52f6da66b062935',
      '0x36c4bd54d54dd898c242f5f634f5d0cef3be2a8a',
      '0xa3f09fcce3e340e251e23263b15d89623564b233',
      '0xf5fb27b912d987b5b6e02a1b1be0c1f0740e2c6f',
      '0xbad1990c2967231bc9a4fa9562ea68e65dd2b25d',
    ].map((x) => ethers.provider.getSigner(x));

    const top10stkBptHolders = [
      '0x4a49985b14bd0ce42c25efde5d8c379a48ab02f3',
      '0x43d74a0080094d4f188eb8896a968712a7ad0391',
      '0x681ada67950d96dcc9f2951d32353663ed6e59c9',
      '0x9b5ea8c719e29a5bd0959faf79c9e5c8206d0490',
      '0xdd709cae362972cb3b92dcead77127f7b8d58202',
      '0xab262d7b21a667b8c5b23b14e25d75be9ac6c3e2',
      '0x36c4bd54d54dd898c242f5f634f5d0cef3be2a8a',
      '0x0af9aeddba36b1a9f9cb983ec5083d06f948041c',
      '0xf5fb27b912d987b5b6e02a1b1be0c1f0740e2c6f',
      '0x0f0eae91990140c560d4156db4f00c854dc8f09e',
    ].map((x) => ethers.provider.getSigner(x));

    // Send ether to the AAVE_WHALE, which is a non payable contract via selfdestruct
    const selfDestructContract = await new SelfdestructTransfer__factory(proposer).deploy();
    await selfDestructContract.deployTransaction.wait();
    await (
      await selfDestructContract.destroyAndTransfer(AAVE_WHALE, {
        value: ethers.utils.parseEther('0.1'),
      })
    ).wait();

    // Impersonating holders
    const whale2 = ethers.provider.getSigner(AAVE_WHALE_2);
    const whale = ethers.provider.getSigner(AAVE_WHALE);

    // Initialize contracts and tokens
    const gov = (await ethers.getContractAt(
      'IAaveGovernanceV2',
      AAVE_GOVERNANCE_V2,
      proposer
    )) as IAaveGovernanceV2;

    const aave = Erc20__factory.connect(AAVE_TOKEN, whale);
    const aaveStakeV2 = StakedAaveV2__factory.connect(AAVE_STAKE, proposer);
    const bptStakeV2 = StakedAaveV2__factory.connect(STK_BPT_STAKE, proposer);

    // Transfer enough AAVE to proposer
    await (await aave.transfer(await proposer.getAddress(), parseEther('100'))).wait();

    await advanceBlockTo((await latestBlock()) + 10);

    // Proposal ID to vote
    const proposalId = '14';

    // Submit vote and advance block to Queue phase
    try {
      await (await gov.connect(whale).submitVote(proposalId, true, { gasLimit: 3000000 })).wait();
      await (await gov.connect(whale2).submitVote(proposalId, true, { gasLimit: 3000000 })).wait();
      console.log('- Voted');
    } catch (error) {
      logError();
      throw error;
    }

    await advanceBlockTo((await latestBlock()) + VOTING_DURATION + 1);

    // Queue and advance block to Execution phase
    try {
      await (await gov.queue(proposalId, { gasLimit: 3000000 })).wait();
      console.log('- Queued');
    } catch (error) {
      logError();
      throw error;
    }
    await increaseTimeTenderly(604800 + 10);

    // Execute
    try {
      await (await gov.execute(proposalId, { gasLimit: 3000000 })).wait();
    } catch (error) {
      logError();
      throw error;
    }

    console.log('- Proposal executed:');
    console.log('- Aave Stake v2 Distribution End');
    console.log('  - Distribution End', await (await aaveStakeV2.DISTRIBUTION_END()).toString());
    console.log('  - Revision', await (await aaveStakeV2.REVISION()).toString());
    console.log('  - Name', await aaveStakeV2.name());
    console.log('  - Symbol', await aaveStakeV2.symbol());
    console.log('  - Decimals', await aaveStakeV2.decimals());
    console.log('- BPT Stake v2');
    console.log('  - Distribution End', await (await bptStakeV2.DISTRIBUTION_END()).toString());
    console.log('  - Revision', await (await bptStakeV2.REVISION()).toString());
    console.log('  - Name', await bptStakeV2.name());
    console.log('  - Symbol', await bptStakeV2.symbol());
    console.log('  - Decimals', await bptStakeV2.decimals());

    const rewardAndRedeem = async (
      signer: Signer,
      stakeTokenAddress: tEthereumAddress,
      tokenName: string
    ) => {
      const stakedToken = await StakedAaveV2__factory.connect(stakeTokenAddress, signer);
      const underlyingToken = Erc20__factory.connect(await stakedToken.STAKED_TOKEN(), signer);

      try {
        await waitForTx(await stakedToken.cooldown({ gasLimit: 3000000 }));
        const startedCooldownAt = await stakedToken.stakersCooldowns(await signer.getAddress());
        const currentTime = await timeLatest();

        const remainingCooldown = startedCooldownAt
          .add(await stakedToken.COOLDOWN_SECONDS())
          .sub(currentTime.toString());

        console.log();
        console.log('Address', await signer.getAddress());
        const aaveBalanceBefore = await aave.balanceOf(await signer.getAddress());
        await waitForTx(
          await stakedToken.claimRewards(await signer.getAddress(), MAX_UINT_AMOUNT, {
            gasLimit: 3000000,
          })
        );
        const aaveBalanceAfter = await aave.balanceOf(await signer.getAddress());
        const rewards = aaveBalanceAfter.sub(aaveBalanceBefore);
        console.log(`- Claimed AAVE:`, await formatEther(rewards));

        await increaseTimeTenderly(remainingCooldown.add('1').toNumber());
        const underlyingBalanceBefore = await underlyingToken.balanceOf(await signer.getAddress());
        await waitForTx(
          await stakedToken.approve(stakedToken.address, MAX_UINT_AMOUNT, { gasLimit: 3000000 })
        );
        await waitForTx(await stakedToken.redeem(await signer.getAddress(), MAX_UINT_AMOUNT));
        const underlyingBalanceAfter = await underlyingToken.balanceOf(await signer.getAddress());

        const redeemed = underlyingBalanceAfter
          .sub(underlyingBalanceBefore)
          .sub(tokenName === 'aave' ? rewards : '0');

        console.log(`- Redeemed ${tokenName}`, formatEther(redeemed));
        await waitForTx(
          await underlyingToken.approve(stakedToken.address, underlyingBalanceAfter, {
            gasLimit: 3000000,
          })
        );
        await waitForTx(
          await stakedToken.stake(await signer.getAddress(), underlyingBalanceAfter, {
            gasLimit: 3000000,
          })
        );
        const sktBalanceAfter = await stakedToken.balanceOf(await signer.getAddress());
        console.log(`- Staked ${tokenName}`, formatEther(sktBalanceAfter));
      } catch (error) {
        logError();
        throw error;
      }
    };

    // Iterate staking and redeem to check if there is still rewards
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 10; y++) {
        await rewardAndRedeem(top10stkAaveHolders[y], aaveStakeV2.address, 'aave');
        await rewardAndRedeem(top10stkBptHolders[y], bptStakeV2.address, 'bpt');
      }
    }
  });
