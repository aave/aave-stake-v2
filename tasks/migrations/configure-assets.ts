import { experimentalAddHardhatNetworkMessageTraceHook, task } from 'hardhat/config';
import { AaveIncentivesController__factory } from '../../types/factories/AaveIncentivesController__factory';
import deployedAssets from '../../asset-addresses.json';
import { Signer } from '@ethersproject/abstract-signer';
import Bluebird from 'bluebird';
import { ethers } from 'ethers';
import { waitForTx } from '../../helpers/misc-utils';

task('configure-asset', 'Deployment in for Main, Kovan and Ropsten networks')
  .addFlag('execute', 'Execute the tx, else prints the config.')
  .addOptionalParam('testedNetwork', 'for test purpose, when network is hardhat')
  .addOptionalParam('testedAdmin', 'for test purpose, when signer is impersonated')
  .setAction(async ({ execute, testedNetwork, testedAdmin }, localBRE) => {
    try {
      const { incentives, assets, incentivesController } = testedNetwork
        ? deployedAssets[testedNetwork]
        : deployedAssets[localBRE.network.name];
      const admin = testedAdmin
        ? localBRE.ethers.provider.getSigner(testedAdmin)
        : (await localBRE.ethers.getSigners())[0];

      const incentivesControllerContract = AaveIncentivesController__factory.connect(
        incentivesController,
        admin
      );

      const config: {
        underlyingAsset: string;
        emissionPerSecond: string;
        totalStaked: ethers.BigNumber;
      }[] = await Bluebird.all(
        incentives.map(async ({ symbol, type, emissionPerSecond }) => {
          const underlyingAsset = assets.find(({ symbol: symb }) => symb === symbol)[
            type + 'Address'
          ];
          const miniERC20 = new localBRE.ethers.Contract(
            underlyingAsset,
            ['function scaledTotalSupply() view returns(uint256)'],
            admin
          );
          return {
            underlyingAsset,
            emissionPerSecond,
            totalStaked: await miniERC20.scaledTotalSupply(),
          };
        }),
        { concurrency: 1 }
      );
      const filteredConfig = config.filter(({ totalStaked }) => totalStaked.gt('0'));

      console.log('CONFIGURATION: \n ', config);
      if (execute) {
        const tx = await incentivesControllerContract.configureAssets(
          filteredConfig.map(({ underlyingAsset }) => underlyingAsset).slice(0, 1),
          filteredConfig.map(({ emissionPerSecond }) => emissionPerSecond).slice(0, 1),
          { gasLimit: 10000000 }
        );
        await waitForTx(tx);

        console.log('\n INCENTIVES CONTROLLER CONFIGURED');
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
