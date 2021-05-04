import { task } from 'hardhat/config';
import {
  Erc20__factory,
  IAaveGovernanceV2,
  IDelegationAwareToken__factory,
  SelfdestructTransfer__factory,
  StakedAaveV2__factory,
} from '../../types';
import { advanceBlockTo, DRE, increaseTime, latestBlock } from '../../helpers/misc-utils';
import { logError } from '../../helpers/tenderly-utils';
import { parseEther, formatEther } from 'ethers/lib/utils';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import { Signer } from '@ethersproject/abstract-signer';

task('proposal-stk-aave-extension:tenderly', 'Create proposal at Tenderly')
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
      IPFS_HASH = 'QmT9qk3CRYbFDWpDFYeAv8T8H1gnongwKhh5J68NLkLir6', // WIP
      AAVE_GOVERNANCE_V2 = '0xEC568fffba86c094cf06b22134B23074DFE2252c', // mainnet
      AAVE_LONG_EXECUTOR = '0x61910ecd7e8e942136ce7fe7943f956cea1cc2f7', // mainnet
    } = process.env;

    if (!AAVE_TOKEN || !IPFS_HASH || !AAVE_GOVERNANCE_V2 || !AAVE_LONG_EXECUTOR) {
      throw new Error('You have not set correctly the .env file, make sure to read the README.md');
    }

    const VOTING_DURATION = 64000;

    const AAVE_WHALE = '0x25f2226b597e8f9514b3f68f00f494cf4f286491';
    const AAVE_WHALE_2 = '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8';

    const AAVE_STAKE = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';
    const STK_BPT_STAKE = '0xa1116930326D21fB917d5A27F1E9943A9595fb47';

    const ethers = DRE.ethers;

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
    await (await aave.transfer(await proposer.getAddress(), parseEther('2000000'))).wait();
    // Transfer enough AAVE to proposer
    await (
      await aave.connect(whale2).transfer(await proposer.getAddress(), parseEther('1200000'))
    ).wait();

    await advanceBlockTo((await latestBlock()) + 10);
    const aaveGovToken = IDelegationAwareToken__factory.connect(AAVE_TOKEN, proposer);

    try {
      const balance = await aave.balanceOf(await proposer.getAddress());
      console.log('AAVE Balance proposer', formatEther(balance));
      const propositionPower = await aaveGovToken.getPowerAtBlock(
        await proposer.getAddress(),
        ((await latestBlock()) - 1).toString(),
        '1'
      );

      console.log(
        `Proposition power of ${await proposer.getAddress()} at block - 1`,
        formatEther(propositionPower)
      );
    } catch (error) {
      console.log(error);
    }
    // Submit proposal
    const proposalId = await gov.getProposalsCount();

    await DRE.run('proposal-stk-extensions', {
      defender,
    });

    // Mine block due flash loan voting protection
    await advanceBlockTo((await latestBlock()) + 1);

    const votingPower = await aaveGovToken.getPowerAtBlock(
      await proposer.getAddress(),
      ((await latestBlock()) - 1).toString(),
      '0'
    );
    console.log(
      `Voting power of ${await proposer.getAddress()} at block - 1`,
      formatEther(votingPower)
    );

    // Submit vote and advance block to Queue phase
    await (await gov.submitVote(proposalId, true)).wait();
    await advanceBlockTo((await latestBlock()) + VOTING_DURATION + 1);

    // Queue and advance block to Execution phase
    try {
      await (await gov.queue(proposalId)).wait();
    } catch (error) {
      logError();
      throw error;
    }
    await increaseTime(604800 + 10);

    // Execute
    try {
      await (await gov.execute(proposalId)).wait();
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
  });
