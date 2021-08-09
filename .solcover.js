const accounts = require(`./test-wallets.ts`).accounts;

module.exports = {
  skipFiles: ['open-zeppelin/', 'mocks/', 'stake/StakedTokenV3.sol', 'lib/'],
  mocha: {
    enableTimeouts: false,
  },
  providerOptions: {
    accounts,
  },
};
