import { task } from 'hardhat/config';
import {
  Erc20__factory,
  IAaveGovernanceV2,
  IDelegationAwareToken__factory,
  SelfdestructTransfer__factory,
  StakedAaveV2__factory,
} from '../../types';
import { advanceBlockTo, DRE, increaseTimeTenderly, latestBlock } from '../../helpers/misc-utils';
import { logError } from '../../helpers/tenderly-utils';
import { parseEther, formatEther } from 'ethers/lib/utils';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import { Signer } from '@ethersproject/abstract-signer';

task('proposal-vault-approval:tenderly', 'Create proposal at Tenderly')
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
      REWARDS_VAULT = '0x25F2226B597E8F9514B3F68F00f494cF4f286491',
      AAVE_STAKE = '0x4da27a545c0c5B758a6BA100e3a049001de870f5',
      STK_BPT_STAKE = '0xa1116930326D21fB917d5A27F1E9943A9595fb47',
    } = process.env;

    if (!AAVE_TOKEN || !AAVE_GOVERNANCE_V2) {
      throw new Error('You have not set correctly the .env file, make sure to read the README.md');
    }

    const VOTING_DURATION = 19200;

    const AAVE_WHALE = '0x25f2226b597e8f9514b3f68f00f494cf4f286491';
    const AAVE_WHALE_2 = '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8';

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

    await DRE.run('proposal-vault-approval', {
      defender: !!defender,
      ipfsHash: '0x4d4a4bda3036f8da3f6911941df8c185f0e4ec248de44b44253dae5a4798a001',
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
    console.log('VOTED');
    await advanceBlockTo((await latestBlock()) + VOTING_DURATION + 1);

    // Queue and advance block to Execution phase
    try {
      await (await gov.queue(proposalId)).wait();
      console.log('QUEUE');
    } catch (error) {
      logError();
      throw error;
    }
    await increaseTimeTenderly(86400 + 10);

    // Execute
    try {
      await (await gov.execute(proposalId, { gasLimit: 3000000 })).wait();
      console.log('exec');
    } catch (error) {
      logError();
      throw error;
    }

    console.log('- Proposal executed:');
    console.log('- Rewards Vault Allowance');
    console.log('  - StakedAave', formatEther(await aave.allowance(REWARDS_VAULT, AAVE_STAKE)));
    console.log('  - StakedBPT', formatEther(await aave.allowance(REWARDS_VAULT, STK_BPT_STAKE)));
  });
