import { task } from 'hardhat/config';
import { AaveIncentivesController__factory } from '../../types/factories/AaveIncentivesController__factory';
import deployedAssets from '../../asset-addresses.json';

task('configure-asset', 'Deployment in for Main, Kovan and Ropsten networks')
  .addFlag('execute', 'Execute the tx, else prints the config.')
  .setAction(async ({ execute }, localBRE) => {
    const { incentives, assets, incentivesController } = deployedAssets[localBRE.network.name];
    const admin = (await localBRE.ethers.getSigners())[0];

    const incentivesControllerContract = AaveIncentivesController__factory.connect(
      incentivesController,
      admin
    );

    const config: {
      underlyingAsset: string;
      emissionPerSecond: string;
      totalStaked: string;
    }[] = await Promise.all(
      incentives.map(async ({ symbol, type, emissionPerSecond }) => {
        const underlyingAsset = assets.find(({ symbol: symb }) => symb === symbol)[
          type + 'Address'
        ];
        const miniERC20 = new localBRE.ethers.Contract(
          underlyingAsset,
          ['function totalSupply() view returns(uint256)'],
          admin
        );
        return {
          underlyingAsset,
          emissionPerSecond,
          totalStaked: (await miniERC20.totalSupply()).toString(),
        };
      })
    );

    console.log('CONFIGURATION: \n ', config);
    if (execute) {
      await incentivesControllerContract.configureAssets(config);
    }
  });
