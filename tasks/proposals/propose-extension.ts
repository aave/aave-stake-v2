import { task } from 'hardhat/config';
import {
  IAaveGovernanceV2__factory,
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
  .addParam('aaveGovernance')
  .addParam('longExecutor')
  .addFlag('defender')
  .setAction(
    async (
      { aaveGovernance, longExecutor, defender, stkAaveProxy, stkAaveImpl },
      localBRE: any
    ) => {
      await localBRE.run('set-dre');

      let proposer: Signer;
      [proposer] = await DRE.ethers.getSigners();

      if (defender) {
        const { signer } = await getDefenderRelaySigner();
        proposer = signer;
      }
      const payload = StakedTokenV2Rev3__factory.connect(
        stkAaveImpl,
        proposer
      ).interface.encodeFunctionData('initialize');
      const callData = DRE.ethers.utils.defaultAbiCoder.encode(
        ['address', 'bytes'],
        [stkAaveImpl, payload]
      );

      const executeSignature = 'upgradeToAndCall(address,bytes)';
      const gov = await IAaveGovernanceV2__factory.connect(aaveGovernance, proposer);

      // WIP IPFS
      const ipfsEncoded = '0xf7a1f565fcd7684fba6fea5d77c5e699653e21cb6ae25fbf8c5dbc8d694c7949';

      try {
        const tx = await gov.create(
          longExecutor,
          [stkAaveProxy],
          ['0'],
          [executeSignature],
          [callData],
          [true],
          ipfsEncoded,
          { gasLimit: 3000000 }
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
