import { task } from 'hardhat/config';

import { eContractid, eEthereumNetwork } from '../../helpers/types';
import { registerContractInJsonDb } from '../../helpers/contracts-helpers';
import { getAaveTokenPerNetwork, ZERO_ADDRESS } from '../../helpers/constants';
import { deployStakedTokenDataProvider } from '../../helpers/contracts-accessors';
import { checkVerification } from '../../helpers/etherscan-verification';

const { StakeUIHelper, StakedAave, StakedTokenDataProvider } = eContractid;

task(`deploy-${StakedTokenDataProvider}`, `Deploys the ${StakedTokenDataProvider} contract`)
  //   .addParam('stkAave', `The address of the ${StakedAave} contract.`)
  //   .addParam('aaveOracle', `The address of the AaveOracle contract.`)
  //   .addParam('bptToken', `The address of the bptToken contract.`)
  //   .addParam('stkBptToken', `The address of the stkBptToken contract.`)
  //   .addParam('ethUsdPriceFeed', `The address of the stkBptToken contract.`)
  //   .addParam('bptPriceFeed', `The address of the bptPriceFeed contract.`)
  //   .addParam('bptWstETH', `The address of the bptWstETH contract.`)
  //   .addParam('bptWstETHPriceFeed', `The address of the bptWstETHPriceFeed contract.`)

  .addFlag('verify', 'Verify StakedAave contract via Etherscan API.')
  .setAction(
    async (
      {
        // stkAave: stkAaveAddress,
        // bptToken,
        // stkBptToken,

        // ethUsdPriceFeed,
        // bptPriceFeed,
        // bptWstETH,
        // bptWstETHPriceFeed,
        // aaveOracle: aavePriceFeed,
        verify,
      },
      localBRE
    ) => {
      await localBRE.run('set-dre');

      // If Etherscan verification is enabled, check needed enviroments to prevent loss of gas in failed deployments.
      if (verify) {
        checkVerification();
      }

      if (!localBRE.network.config.chainId) {
        throw new Error('INVALID_CHAIN_ID');
      }

      const network = localBRE.network.name as eEthereumNetwork;

      console.log(`\n- ${network} network`);
      console.log(`\n- ${StakeUIHelper} deployment`);
      console.log(`\tDeploying ${StakeUIHelper} implementation ...`);

      const [
        aaveToken,
        stkAaveAddress,
        bptToken,
        stkBptToken,
        ethUsdPriceFeed,
        aavePriceFeed,
        bptPriceFeed,

        bptWstETH,
        bptWstETHPriceFeed,
      ] = [
        '0x9c0435779F5E52CEC404D957C9bAa6f7d674C8bA', // aave tokeb
        '0x4da27a545c0c5b758a6ba100e3a049001de870f5', //proxy
        '0x41a08648c3766f9f9d85598ff102a08f4ef84f84', // bpt
        '0xa1116930326d21fb917d5a27f1e9943a9595fb47', // stkbpt
        '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419', // https://data.chain.link/ethereum/mainnet/crypto-usd/eth-usd
        '0xa50ba011c48153de246e5192c8f9258a2ba79ca9', // aave oracle
        ZERO_ADDRESS, // TODO use bptPriceFeed,

        '0x41a08648c3766f9f9d85598ff102a08f4ef84f84', // TODO use actual pool mocking current bpt
        ZERO_ADDRESS, // TODO use actual price feed
      ];

      //   const aaveToken = getAaveTokenPerNetwork(network);

      const stakedTokenDataProvider = await deployStakedTokenDataProvider(
        [
          aaveToken,
          stkAaveAddress,
          bptToken,
          stkBptToken,
          ethUsdPriceFeed,
          aavePriceFeed,
          bptPriceFeed,

          bptWstETH,
          bptWstETHPriceFeed,
        ],
        verify
      );

      await stakedTokenDataProvider.deployTransaction.wait();
      await registerContractInJsonDb('StakedTokenDataProvider', stakedTokenDataProvider);

      console.log('stakedTokenDataProvider deployed to', stakedTokenDataProvider.address);
    }
  );
