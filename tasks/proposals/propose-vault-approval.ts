import { task } from 'hardhat/config';
import { IAaveGovernanceV2__factory } from '../../types';
import { Signer } from 'ethers';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import { DRE } from '../../helpers/misc-utils';
import { logError } from '../../helpers/tenderly-utils';
import { MAX_UINT_AMOUNT } from '../../helpers/constants';

task('propose-vault-approval', 'Create some proposals and votes')
  .addParam('rewardsVaultController')
  .addParam('aaveProxy')
  .addParam('stkAaveProxy')
  .addParam('stkBptProxy')
  .addParam('aaveGovernance')
  .addParam('shortExecutor')
  .addParam('ipfsHash')
  .addFlag('defender')
  .setAction(
    async (
      {
        rewardsVaultController,
        aaveGovernance,
        shortExecutor,
        defender,
        stkAaveProxy,
        stkBptProxy,
        aaveProxy,
        ipfsHash,
      },
      localBRE: any
    ) => {
      await localBRE.run('set-dre');

      let proposer: Signer;
      [proposer] = await DRE.ethers.getSigners();

      if (defender) {
        const { signer } = await getDefenderRelaySigner();
        proposer = signer;
      }

      // Calldata for StkAave approval
      const payloadForStkAaveApproval = DRE.ethers.utils.defaultAbiCoder.encode(
        ['address', 'address', 'uint256'],
        [aaveProxy, stkAaveProxy, MAX_UINT_AMOUNT]
      );
      // Calldata for StkBpt approval
      const payloadForStkBPTApproval = DRE.ethers.utils.defaultAbiCoder.encode(
        ['address', 'address', 'uint256'],
        [aaveProxy, stkBptProxy, MAX_UINT_AMOUNT]
      );

      const executeSignature = 'approve(address,address,uint256)';
      const gov = await IAaveGovernanceV2__factory.connect(aaveGovernance, proposer);

      try {
        const tx = await gov.create(
          shortExecutor,
          [rewardsVaultController, rewardsVaultController],
          ['0', '0'],
          [executeSignature, executeSignature],
          [payloadForStkAaveApproval, payloadForStkBPTApproval],
          [false, false],
          ipfsHash,
          { gasLimit: 1000000 }
        );
        await tx.wait();
        console.log('- Proposal submitted to Governance');
      } catch (error) {
        logError();
        throw error;
      }
    }
  );
