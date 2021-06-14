import { task } from 'hardhat/config';
import { AaveIncentivesController__factory } from '../../types/factories/AaveIncentivesController__factory';
import deployedAssets from '../../asset-addresses.json';
import { Signer } from '@ethersproject/abstract-signer';
import { DRE, waitForTx } from '../../helpers/misc-utils';

task('configure-asset', 'Deployment in for Main, Kovan and Ropsten networks')
  .addFlag('execute', 'Execute the tx, else prints the config.')
  .addOptionalParam('testedNetwork', 'for test purpose, when network is hardhat')
  .addOptionalParam('testedAdmin', 'for test purpose, when signer is impersonated')
  .setAction(async ({ execute, testedNetwork, testedAdmin }, localBRE) => {
    await localBRE.run('set-dre');

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
      try {
        await waitForTx(
          await incentivesControllerContract.configureAssets(
            config.map((x) => x.underlyingAsset),
            config.map((x) => x.emissionPerSecond),
            { gasLimit: 12000000 }
          )
        );
        console.log('\n INCENTIVES CONTROLLER CONFIGURED');
      } catch (error) {
        if (DRE.network.name.includes('tenderly')) {
          const transactionLink = `https://dashboard.tenderly.co/${DRE.config.tenderly.username}/${
            DRE.config.tenderly.project
          }/fork/${DRE.tenderly
            .network()
            .getFork()}/simulation/${DRE.tenderly.network().getHead()}`;
          console.error('Check tx error:', transactionLink);
        }
      }
    }
  });
