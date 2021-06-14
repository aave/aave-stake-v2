import { task } from 'hardhat/config';
import { DRE, usingTenderly } from '../../helpers/misc-utils';
import { eEthereumNetwork } from '../../helpers/types';

task('fork-incentives-change-emission', 'Deployment in for Main, Kovan and Ropsten networks')
  .addParam('net', 'Network of the Tenderly fork')
  .addParam('admin', 'Admin of the incentives controller')
  .setAction(async ({ net, admin }, localBRE) => {
    await localBRE.run('set-dre');

    const network = localBRE.network.name;

    if (network != eEthereumNetwork.tenderly) {
      console.error('This is a fork only task. Exiting...');
      return;
    }

    await localBRE.run('configure-asset', {
      execute: true,
      testedNetwork: net,
      testedAdmin: admin,
    });

    if (usingTenderly()) {
      const postDeployHead = DRE.tenderly.network().getHead();
      const postDeployFork = DRE.tenderly.network().getFork();
      console.log('Tenderly Info');
      console.log('- Head', postDeployHead);
      console.log('- Fork', postDeployFork);
    }
  });
