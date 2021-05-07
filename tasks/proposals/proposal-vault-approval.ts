import { task } from 'hardhat/config';
import { Signer } from 'ethers';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import { DRE } from '../../helpers/misc-utils';

task('proposal-vault-approval', 'Create some proposals and votes')
  .addParam('ipfsHash')
  .addFlag('defender')
  .setAction(async ({ defender, ipfsHash }, localBRE: any) => {
    await localBRE.run('set-dre');

    let proposer: Signer;
    [proposer] = await DRE.ethers.getSigners();

    if (defender) {
      const { signer } = await getDefenderRelaySigner();
      proposer = signer;
    }
    const {
      AAVE_TOKEN = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
      AAVE_GOVERNANCE_V2 = '0xEC568fffba86c094cf06b22134B23074DFE2252c',
      REWARDS_CONTROLLER = '0x1E506cbb6721B83B1549fa1558332381Ffa61A93',
      AAVE_SHORT_EXECUTOR = '0xEE56e2B3D491590B5b31738cC34d5232F378a8D5',
      AAVE_STAKE = '0x4da27a545c0c5B758a6BA100e3a049001de870f5',
      STK_BPT_STAKE = '0xa1116930326D21fB917d5A27F1E9943A9595fb47',
    } = process.env;

    await DRE.run('propose-vault-approval', {
      aaveProxy: AAVE_TOKEN,
      aaveGovernance: AAVE_GOVERNANCE_V2,
      rewardsVaultController: REWARDS_CONTROLLER,
      shortExecutor: AAVE_SHORT_EXECUTOR,
      stkAaveProxy: AAVE_STAKE,
      stkBptProxy: STK_BPT_STAKE,
      ipfsHash,
      defender,
    });
  });
