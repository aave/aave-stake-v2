const accounts = require(`./test-wallets.ts`).accounts;

module.exports = {
  skipFiles: ['open-zeppelin/', 'mocks/'],
  mocha: {
    enableTimeouts: false,
  },
  providerOptions: {
    accounts,
  },
};
