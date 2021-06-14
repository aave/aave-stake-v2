import { task } from 'hardhat/config';
import { eEthereumNetwork } from '../../helpers/types';
import deployedAssets from '../../asset-addresses.json';
import { DRE, usingTenderly, waitForTx } from '../../helpers/misc-utils';
import { AaveIncentivesController__factory } from '../../types/factories/AaveIncentivesController__factory';

task('fork-incentives-end-of-distribution', 'Deployment in for Main, Kovan and Ropsten networks')
  .addParam('net', 'for test purpose, when network is hardhat')
  .addParam('admin', 'for test purpose, when signer is impersonated')
  .setAction(async ({ net, admin }, localBRE) => {
    await localBRE.run('set-dre');

    const network = localBRE.network.name;

    if (network != eEthereumNetwork.tenderly) {
      console.error('This is a fork only task. Exiting...');
      return;
    }

    const { incentivesController } = deployedAssets[net];

    const owner = await DRE.ethers.provider.getSigner(admin);

    const { timestamp } = await DRE.ethers.provider.getBlock('latest');

    const incentivesControllerContract = AaveIncentivesController__factory.connect(
      incentivesController,
      owner
    );

    await waitForTx(await incentivesControllerContract.setDistributionEnd(timestamp));
    console.log('- Executed the end of distributions');

    console.log(
      '- Distribution end of incentives at',
      (await incentivesControllerContract.getDistributionEnd()).toString()
    );

    if (usingTenderly()) {
      const postDeployHead = DRE.tenderly.network().getHead();
      const postDeployFork = DRE.tenderly.network().getFork();
      console.log('Tenderly Info');
      console.log('- Head', postDeployHead);
      console.log('- Fork', postDeployFork);
    }
  });
