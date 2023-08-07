import { task } from 'hardhat/config';

import { eContractid, eEthereumNetwork } from '../../helpers/types';
import { registerContractInJsonDb } from '../../helpers/contracts-helpers';
import { getAaveTokenPerNetwork, ZERO_ADDRESS } from '../../helpers/constants';
import { deployStakedTokenDataProvider } from '../../helpers/contracts-accessors';
import { checkVerification } from '../../helpers/etherscan-verification';

import {
  AAVE_TOKEN,
  STK_BPT,
  AAVE_BPT_POOL_TOKEN,
  STK_WSTEH,
  STAKED_AAVE,
  ETH_USD_PRICE_FEED,
  AAVE_ORACLE,
  BPT_PRICE_FEED,
} from '../../helpers/constants';

const { StakeUIHelper, StakedAave, StakedTokenDataProvider } = eContractid;

task(`deploy-${StakedTokenDataProvider}`, `Deploys the ${StakedTokenDataProvider} contract`)
  .addFlag('verify', 'Verify StakedAave contract via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
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
      AAVE_TOKEN,
      STAKED_AAVE,
      AAVE_BPT_POOL_TOKEN,
      STK_BPT,
      ETH_USD_PRICE_FEED, // https://data.chain.link/ethereum/mainnet/crypto-usd/eth-usd
      AAVE_ORACLE, // aave oracle
      BPT_PRICE_FEED,

      AAVE_BPT_POOL_TOKEN, // TODO use actual pool mocking current bpt
      BPT_PRICE_FEED, // TODO use actual price feed
    ];

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
  });
