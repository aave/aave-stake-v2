import rawBRE from 'hardhat';
import { makeSuite, TestEnv } from '../helpers/make-suite';

import { deployStakedTokenDataProvider } from '../../helpers/contracts-accessors';
import { network, ethers } from 'hardhat';
import { BigNumber } from 'ethers';
const { expect } = require('chai');

import {
  STK_WHALE,
  BPT_WHALE,
  STK_BPT,
  AAVE_TOKEN,
  AAVE_BPT_POOL_TOKEN,
  STK_WSTEH,
  STK_WSTEH_WHALE,
  ETH_USD_PRICE_FEED,
  AAVE_ORACLE,
  BPT_PRICE_FEED,
  COLLECTOR,
  STAKED_AAVE,
  STK_WSTEH_PRICE_FEED,
} from '../../helpers/constants';

import { SHORT_EXECUTOR } from '../../helpers/constants';

rawBRE.run('set-dre').then(async () => {
  let stakedDataProvider;

  makeSuite('Deploy stake ui provider', async (testEnv: TestEnv) => {
    beforeEach(async () => {
      const [aaveToken, stkAaveAddress, ethUsdPriceFeed, aavePriceFeed] = [
        AAVE_TOKEN,
        STAKED_AAVE,
        ETH_USD_PRICE_FEED,
        AAVE_ORACLE,
      ];
      stakedDataProvider = await deployStakedTokenDataProvider([
        AAVE_TOKEN,
        stkAaveAddress,
        ethUsdPriceFeed,
        aavePriceFeed,
      ]);
      await stakedDataProvider.deployTransaction.wait();
      console.log('staked token provider deployed', stakedDataProvider.address);
    });

    it('Should have property inPostSlashingPeriod and be false', async () => {
      const whaleData = await stakedDataProvider.getStakedUserData(
        STK_WHALE,
        STAKED_AAVE,
        AAVE_ORACLE
      );

      expect(whaleData[0]).to.have.property('inPostSlashingPeriod');
      expect(whaleData[0].inPostSlashingPeriod).to.equal(false);
    });

    it('Should get STKAAVE data and have property inPostSlashingPeriod and be false', async () => {
      const whaleData = await stakedDataProvider.getStakedUserData(
        STK_WHALE,
        STAKED_AAVE,
        AAVE_ORACLE
      );

      expect(whaleData).to.be.an('array');
      expect(whaleData).to.have.lengthOf(2);
      expect(whaleData[0]).to.have.property('inPostSlashingPeriod');
    });
    it('Should get BPT data', async () => {
      const whaleData = await stakedDataProvider.getStakedUserData(
        BPT_WHALE,
        STK_BPT,
        BPT_PRICE_FEED
      );

      expect(whaleData).to.be.an('array');
      expect(whaleData).to.have.lengthOf(2);
      expect(whaleData[0]).to.have.property('inPostSlashingPeriod');
      expect(whaleData[0].inPostSlashingPeriod).to.equal(false);
    });

    it('Should get WSTEH data ', async () => {
      const whaleData = await stakedDataProvider.getStakedUserData(
        STK_WSTEH_WHALE,
        STK_WSTEH,
        STK_WSTEH_PRICE_FEED
      );

      expect(whaleData).to.be.an('array');
      expect(whaleData).to.have.lengthOf(2);
      expect(whaleData[0]).to.have.property('inPostSlashingPeriod');
      expect(whaleData[0].inPostSlashingPeriod).to.equal(false);
    });

    it('Should get slash stkAave and inPostSlashingPeriod be updated to true ', async () => {
      const stakedAave = await ethers.getContractAt('AggregatedStakedTokenV3', STAKED_AAVE);

      const preSlashWhale = await stakedDataProvider.getStakedUserData(
        STK_WHALE,
        STAKED_AAVE,
        AAVE_ORACLE
      );
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

      const postSlashWhaleData = await stakedDataProvider.getStakedUserData(
        STK_WHALE,
        STAKED_AAVE,
        AAVE_ORACLE
      );
      expect(postSlashWhaleData[0].inPostSlashingPeriod).to.equal(true);
    });
    it('Should get slash BPTAave and inPostSlashingPeriod be updated to true ', async () => {
      const stakedAave = await ethers.getContractAt('AggregatedStakedTokenV3', STK_BPT);

      const preSlashWhale = await stakedDataProvider.getStakedUserData(
        BPT_WHALE,
        STK_BPT,
        BPT_PRICE_FEED
      );
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

      const postSlashWhaleData = await stakedDataProvider.getStakedUserData(
        STK_WHALE,
        STAKED_AAVE,
        AAVE_TOKEN
      );
      expect(postSlashWhaleData[0].inPostSlashingPeriod).to.equal(true);
    });

    it('should get stakeduser data across various assets and return ', async () => {
      const stakedUserBatch = await stakedDataProvider.getStakedUserDataBatch(
        [STAKED_AAVE, STK_BPT],
        [AAVE_ORACLE, BPT_PRICE_FEED],
        [STK_WHALE, BPT_WHALE]
      );

      const stakedTokenAaveContract = await ethers.getContractAt(
        'AggregatedStakedAaveV3',
        STAKED_AAVE
      );
      const stakedTokenBPTContract = await ethers.getContractAt('AggregatedStakedAaveV3', STK_BPT);

      // check array length
      expect(stakedUserBatch[0].length).to.equal(2);
      expect(stakedUserBatch[1].length).to.equal(2);

      // check aave data
      const stkAaveBalance = await stakedTokenAaveContract.balanceOf(STK_WHALE);
      const sktAaveRewards = await stakedTokenAaveContract.getTotalRewardsBalance(STK_WHALE);

      expect(stakedUserBatch[1][0].stakedTokenUserBalance.eq(stkAaveBalance)).to.be.true;
      expect(stakedUserBatch[1][0].rewardsToClaim.eq(sktAaveRewards)).to.be.true;

      // check bpt
      const stkBPTBalance = await stakedTokenBPTContract.balanceOf(BPT_WHALE);
      const sktBPTRewards = await stakedTokenBPTContract.getTotalRewardsBalance(BPT_WHALE);

      expect(stakedUserBatch[1][1].stakedTokenUserBalance.eq(stkBPTBalance)).to.be.true;
      expect(stakedUserBatch[1][1].rewardsToClaim.eq(sktBPTRewards)).to.be.true;
    });

    it('should get staked assets batch data and check prices oracles are correct', async () => {
      const aaveOracle = await ethers.getContractAt('AggregatorInterface', AAVE_ORACLE);
      const aavePriceAnswer = await aaveOracle.latestAnswer();

      const bptOracle = await ethers.getContractAt('AggregatorInterface', BPT_PRICE_FEED);
      const bptPriceAnswer = await bptOracle.latestAnswer();

      const stakedAssetsBatch = await stakedDataProvider.getStakedAssetDataBatch(
        [STAKED_AAVE, STK_BPT],
        [AAVE_ORACLE, BPT_PRICE_FEED]
      );

      expect(stakedAssetsBatch[0].length).to.equal(2);
      expect(stakedAssetsBatch[1].length).to.equal(2);
      expect(stakedAssetsBatch[2].length).to.equal(2);

      const stakedAavePrice = BigNumber.from(stakedAssetsBatch[1][0]);
      const stakedBptPrice = BigNumber.from(stakedAssetsBatch[1][1]);

      expect(stakedAavePrice.eq(aavePriceAnswer)).to.be.true;
      expect(stakedBptPrice.eq(bptPriceAnswer)).to.be.true;
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
