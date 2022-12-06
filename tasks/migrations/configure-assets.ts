import { task } from 'hardhat/config';
import { AaveIncentivesController__factory } from '../../types/factories/AaveIncentivesController__factory';
import deployedAssets from '../../asset-addresses.json';

task('configure-asset', 'Deployment in for Main, Kovan and Ropsten networks')
  .addFlag('execute', 'Execute the tx, else prints the config.')
  .addOptionalParam('testedNetwork', 'for test purpose, when network is hardhat')
  .addOptionalParam('testedAdmin', 'for test purpose, when signer is impersonated')
  .setAction(async ({ execute, testedNetwork, testedAdmin }, localBRE) => {
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

    const assetsConfiguration: {
      assets: string[];
      emissionPerSecond: string[];
    } = incentives.reduce(
      (acc, { symbol, type, emissionPerSecond }) => {
        const underlyingAsset = assets.find(({ symbol: symb }) => symb === symbol)[
          type + 'Address'
        ];

        acc.assets.push(underlyingAsset);
        acc.emissionPerSecond.push(emissionPerSecond);

        return acc;
      },
      { assets: [], emissionPerSecond: [] }
    );

    console.log('CONFIGURATION: \n ', JSON.stringify(assetsConfiguration, null, 2));
    if (execute) {
      await incentivesControllerContract.configureAssets(
        assetsConfiguration.assets,
        assetsConfiguration.emissionPerSecond
      );
      console.log('\n INCENTIVES CONTROLLER CONFIGURED');
    }
  });
