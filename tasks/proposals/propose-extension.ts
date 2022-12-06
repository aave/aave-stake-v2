import { task } from 'hardhat/config';
import {
  IAaveGovernanceV2__factory,
  StakedTokenBptRev2__factory,
  StakedTokenV2Rev3,
  StakedTokenV2Rev3__factory,
} from '../../types';
import { Signer } from 'ethers';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import { DRE } from '../../helpers/misc-utils';
import { logError } from '../../helpers/tenderly-utils';

task('propose-extension', 'Create some proposals and votes')
  .addParam('stkAaveProxy')
  .addParam('stkAaveImpl')
  .addParam('stkBptProxy')
  .addParam('stkBptImpl')
  .addParam('aaveGovernance')
  .addParam('longExecutor')
  .addParam('ipfsHash')
  .addFlag('defender')
  .setAction(
    async (
      {
        aaveGovernance,
        longExecutor,
        defender,
        stkAaveProxy,
        stkAaveImpl,
        stkBptProxy,
        stkBptImpl,
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

      if (!stkAaveImpl) {
        throw '[hh-task][propose-extension] stkAaveImpl param is missing';
      }
      if (!stkBptImpl) {
        throw '[hh-task][propose-extension] stkBptImpl param is missing';
      }
      if (!longExecutor) {
        throw '[hh-task][propose-extension] longExecutor param is missing';
      }
      if (!stkAaveProxy) {
        throw '[hh-task][propose-extension] stkAaveProxy param is missing';
      }
      if (!stkBptProxy) {
        throw '[hh-task][propose-extension] stkBptProxy param is missing';
      }
      if (!ipfsHash) {
        throw '[hh-task][propose-extension] ipfsHash param is missing';
      }

      // Calldata for StkAave implementation
      const payloadStkAave = StakedTokenV2Rev3__factory.connect(
        stkAaveImpl,
        proposer
      ).interface.encodeFunctionData('initialize');
      const callDataStkAave = DRE.ethers.utils.defaultAbiCoder.encode(
        ['address', 'bytes'],
        [stkAaveImpl, payloadStkAave]
      );

      // Calldata for StkBpt implementation
      // Empty arguments for initializer due they are not used
      const payloadStkBpt = StakedTokenBptRev2__factory.connect(
        stkBptImpl,
        proposer
      ).interface.encodeFunctionData('initialize', ['', '', '18']);
      const callDataStkBpt = DRE.ethers.utils.defaultAbiCoder.encode(
        ['address', 'bytes'],
        [stkBptImpl, payloadStkBpt]
      );
      const executeSignature = 'upgradeToAndCall(address,bytes)';
      const gov = await IAaveGovernanceV2__factory.connect(aaveGovernance, proposer);

      try {
        const tx = await gov.create(
          longExecutor,
          [stkAaveProxy, stkBptProxy],
          ['0', '0'],
          [executeSignature, executeSignature],
          [callDataStkAave, callDataStkBpt],
          [false, false],
          ipfsHash,
          { gasLimit: 1000000 }
        );
        console.log('- Proposal submitted to Governance');
        await tx.wait();
      } catch (error) {
        logError();
        throw error;
      }

      console.log('Your Proposal has been submitted');
    }
  );
