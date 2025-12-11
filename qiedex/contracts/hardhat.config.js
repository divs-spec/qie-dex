require("@nomiclabs/hardhat-waffle");

module.exports = {
  solidity: "0.8.19",
  paths: {
    sources: "./contracts_src",
    tests: "./test"
  },
  networks: {
    hardhat: {}
  }
};
