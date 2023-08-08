import rawBRE from 'hardhat';
import { makeSuite, TestEnv } from '../helpers/make-suite';

import { deployStakedTokenDataProvider } from '../../helpers/contracts-accessors';
import { network, ethers } from 'hardhat';
const { expect } = require('chai');

import { SHORT_EXECUTOR } from '../../helpers/constants';

rawBRE.run('set-dre').then(async () => {
  let stakedDataProvider;
  const STK_WHALE = '0xaFDAbFb6227507fF6522b8a242168F6b5F353a6E';
  const BPT_WHALE = '0x741AA7CFB2c7bF2A1E7D4dA2e3Df6a56cA4131F3';
  const STK_BPT = '0xa1116930326d21fb917d5a27f1e9943a9595fb47';
  const AAVE_TOKEN = '0x9c0435779F5E52CEC404D957C9bAa6f7d674C8bA';
  const AAVE_BPT_POOL_TOKEN = '0x41a08648c3766f9f9d85598ff102a08f4ef84f84';

  const STK_WSTEH = '0xa1116930326d21fb917d5a27f1e9943a9595fb47'; // todo change for actual token
  const STK_WSTEH_WHALE = '0x741AA7CFB2c7bF2A1E7D4dA2e3Df6a56cA4131F3';

  const STAKED_AAVE = '0x4da27a545c0c5b758a6ba100e3a049001de870f5';
  const ETH_USD_PRICE_FEED = '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419';
  const AAVE_ORACLE = '0x6Df09E975c830ECae5bd4eD9d90f3A95a4f88012';
  const BPT_PRICE_FEED = '0x0De156f178a20114eeec0eBF71d7772064476b0D';
  const COLLECTOR = '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c';

  makeSuite('Deploy stake ui provider', async (testEnv: TestEnv) => {
    beforeEach(async () => {
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
        AAVE_ORACLE,
        BPT_PRICE_FEED,
        AAVE_BPT_POOL_TOKEN, // TODO use actual pool mocking current WSTETH
        BPT_PRICE_FEED, // TODO use actual price feed WSTETH
      ];
      stakedDataProvider = await deployStakedTokenDataProvider([
        aaveToken,
        stkAaveAddress,
        bptToken,
        stkBptToken,
        ethUsdPriceFeed,
        aavePriceFeed,
        bptPriceFeed,
        bptWstETH,
        bptWstETHPriceFeed,
      ]);
      await stakedDataProvider.deployTransaction.wait();
      console.log('staked token provider deployed', stakedDataProvider.address);
    });

    it('Should have property inPostSlashingPeriod and be false', async () => {
      const whaleData = await stakedDataProvider.getStakedUserData(STK_WHALE, STAKED_AAVE);

      expect(whaleData[0]).to.have.property('inPostSlashingPeriod');
      expect(whaleData[0].inPostSlashingPeriod).to.equal(false);
    });

    it('Should get STKAAVE data and have property inPostSlashingPeriod and be false', async () => {
      const whaleData = await stakedDataProvider.getStakedUserData(STK_WHALE, STAKED_AAVE);

      expect(whaleData).to.be.an('array');
      expect(whaleData).to.have.lengthOf(2);
      expect(whaleData[0]).to.have.property('inPostSlashingPeriod');
      // expect(whaleData[0].inPostSlashingPeriod).to.equal(false);
    });
    it('Should get BPT data', async () => {
      const whaleData = await stakedDataProvider.getStakedUserData(BPT_WHALE, STK_BPT);

      expect(whaleData).to.be.an('array');
      expect(whaleData).to.have.lengthOf(2);
      expect(whaleData[0]).to.have.property('inPostSlashingPeriod');
      expect(whaleData[0].inPostSlashingPeriod).to.equal(false);
    });

    it('Should get WSTEH data ', async () => {
      const whaleData = await stakedDataProvider.getStakedUserData(STK_WSTEH_WHALE, STK_WSTEH);

      expect(whaleData).to.be.an('array');
      expect(whaleData).to.have.lengthOf(2);
      expect(whaleData[0]).to.have.property('inPostSlashingPeriod');
      expect(whaleData[0].inPostSlashingPeriod).to.equal(false);
    });

    it('Should get slash stkAave and inPostSlashingPeriod be updated to true ', async () => {
      const stakedAave = await ethers.getContractAt('AggregatedStakedTokenV3', STAKED_AAVE);

      const preSlashWhale = await stakedDataProvider.getStakedUserData(STK_WHALE, STAKED_AAVE);
      expect(preSlashWhale[0].inPostSlashingPeriod).to.equal(false);

      const totalSupply = (await stakedAave.totalSupply()).toString();
      const previewRedeem = await stakedAave.previewRedeem(totalSupply);
      let amountToSlash20 = previewRedeem.mul(2).div(10);

      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [SHORT_EXECUTOR],
      });

      const balance = ethers.utils.parseEther('5000');
      const newBalanceHex = balance.toHexString().replace('0x0', '0x');

      await network.provider.send('hardhat_setBalance', [SHORT_EXECUTOR, newBalanceHex]);

      const signer = await ethers.provider.getSigner(SHORT_EXECUTOR);

      await stakedAave.connect(signer).slash(COLLECTOR, amountToSlash20);

      const postSlashWhaleData = await stakedDataProvider.getStakedUserData(STK_WHALE, STAKED_AAVE);
      expect(postSlashWhaleData[0].inPostSlashingPeriod).to.equal(true);
    });
    it('Should get slash BPTAave and inPostSlashingPeriod be updated to true ', async () => {
      const stakedAave = await ethers.getContractAt('AggregatedStakedTokenV3', STK_BPT);

      const preSlashWhale = await stakedDataProvider.getStakedUserData(BPT_WHALE, STK_BPT);
      expect(preSlashWhale[0].inPostSlashingPeriod).to.equal(false);

      const totalSupply = (await stakedAave.totalSupply()).toString();
      const previewRedeem = await stakedAave.previewRedeem(totalSupply);
      let amountToSlash20 = previewRedeem.mul(2).div(10);

      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [SHORT_EXECUTOR],
      });

      const balance = ethers.utils.parseEther('5000');
      const newBalanceHex = balance.toHexString().replace('0x0', '0x');

      await network.provider.send('hardhat_setBalance', [SHORT_EXECUTOR, newBalanceHex]);

      const signer = await ethers.provider.getSigner(SHORT_EXECUTOR);

      await stakedAave.connect(signer).slash(COLLECTOR, amountToSlash20);

      const postSlashWhaleData = await stakedDataProvider.getStakedUserData(STK_WHALE, STAKED_AAVE);
      expect(postSlashWhaleData[0].inPostSlashingPeriod).to.equal(true);
    });

    // TODO add test with new token
    xit('Should get slash wSTEHAave and inPostSlashingPeriod be updated to true ', async () => {
      const stakedAave = await ethers.getContractAt('AggregatedStakedTokenV3', STK_WSTEH);

      const preSlashWhale = await stakedDataProvider.getStakedUserData(STK_WSTEH_WHALE, STK_WSTEH);
      expect(preSlashWhale[0].inPostSlashingPeriod).to.equal(false);

      const totalSupply = (await stakedAave.totalSupply()).toString();
      const previewRedeem = await stakedAave.previewRedeem(totalSupply);
      let amountToSlash20 = previewRedeem.mul(2).div(10);

      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [SHORT_EXECUTOR],
      });

      const balance = ethers.utils.parseEther('5000');
      const newBalanceHex = balance.toHexString().replace('0x0', '0x');

      await network.provider.send('hardhat_setBalance', [SHORT_EXECUTOR, newBalanceHex]);

      const signer = await ethers.provider.getSigner(SHORT_EXECUTOR);

      await stakedAave.connect(signer).slash(COLLECTOR, amountToSlash20);

      const postSlashWhaleData = await stakedDataProvider.getStakedUserData(STK_WHALE, STAKED_AAVE);
      expect(postSlashWhaleData[0].inPostSlashingPeriod).to.equal(true);
    });
  });
});
