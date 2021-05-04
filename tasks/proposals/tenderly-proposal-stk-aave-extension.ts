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
import { deployStakedTokenV2Revision3 } from '../../helpers/contracts-accessors';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';

task('proposal-stk-aave-extension:tenderly', 'Create proposal at Tenderly').setAction(
  async ({}, localBRE: any) => {
    await localBRE.run('set-dre');
    const { signer: proposer } = await getDefenderRelaySigner();
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

    const ethers = DRE.ethers;

    // Deploy STKAaveV2 Revision 3 implementation
    const stakedAaveV2Revision3Implementation = await deployStakedTokenV2Revision3(
      [
        '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
        '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
        '864000',
        '172800',
        '0x25F2226B597E8F9514B3F68F00f494cF4f286491',
        '0xEE56e2B3D491590B5b31738cC34d5232F378a8D5',
        '3153600000',
        'Staked AAVE',
        'stkAAVE',
        '18',
        '0x0000000000000000000000000000000000000000',
      ],
      true
    );

    // Send ether to the AAVE_WHALE, which is a non payable contract via selfdestruct
    const selfDestructContract = await new SelfdestructTransfer__factory(proposer).deploy();
    await (
      await selfDestructContract.destroyAndTransfer(AAVE_WHALE, {
        value: ethers.utils.parseEther('1'),
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

    await DRE.run('propose-extension', {
      stkAaveProxy: AAVE_STAKE,
      stkAaveImpl: stakedAaveV2Revision3Implementation.address,
      aaveGovernance: AAVE_GOVERNANCE_V2,
      longExecutor: AAVE_LONG_EXECUTOR,
      ipfsHash: IPFS_HASH,
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

    console.log('- Proposal executed');
    console.log('- Aave Stake v2: Distribution End', await aaveStakeV2.DISTRIBUTION_END());
    console.log('- Aave Stake v2: Revision', await aaveStakeV2.REVISION());
  }
);
