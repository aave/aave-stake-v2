import { task } from 'hardhat/config';
import { DRE, usingTenderly, waitForTx } from '../../helpers/misc-utils';
import { eEthereumNetwork } from '../../helpers/types';
import deployedAssets from '../../asset-addresses.json';
import {
  getAaveIncentivesController,
  getInitializableAdminUpgradeabilityProxy,
} from '../../helpers/contracts-accessors';
import { AaveIncentivesController__factory } from '../../types/factories/AaveIncentivesController__factory';

task('fork-incentives-upgrade-proxy', 'Upgrade the Proxy Implementation to a new revision')
  .addParam('net', 'Network of the Tenderly fork')
  .addParam('proxyAdmin', 'Admin of the incentives controller')
  .addParam('implementation', 'New implementation of Incentives')
  .addParam('rewardsVault', 'Rewards Vault Address')
  .setAction(async ({ net, proxyAdmin, implementation }, localBRE) => {
    await localBRE.run('set-dre');

    const network = localBRE.network.name;

    if (network != eEthereumNetwork.tenderly) {
      console.error('This is a fork only task. Exiting...');
      return;
    }

    const { incentivesController } = deployedAssets[net];

    const proxySigner = await DRE.ethers.provider.getSigner(proxyAdmin);

    const proxy = await (
      await getInitializableAdminUpgradeabilityProxy(incentivesController)
    ).connect(proxySigner);

    try {
      await waitForTx(await proxy.upgradeTo(implementation, { gasLimit: 6000000 }));
      console.log(
        '\n- Proxy implementation of IncentivesController updated to',
        implementation,
        '\n'
      );
    } catch (error) {
      if (DRE.network.name.includes('tenderly')) {
        const transactionLink = `https://dashboard.tenderly.co/${DRE.config.tenderly.username}/${
          DRE.config.tenderly.project
        }/fork/${DRE.tenderly.network().getFork()}/simulation/${DRE.tenderly.network().getHead()}`;
        console.error('Check tx error:', transactionLink);
      }
    }

    if (usingTenderly()) {
      const postDeployHead = DRE.tenderly.network().getHead();
      const postDeployFork = DRE.tenderly.network().getFork();
      console.log('Tenderly Info');
      console.log('- Head', postDeployHead);
      console.log('- Fork', postDeployFork);
    }
  });
