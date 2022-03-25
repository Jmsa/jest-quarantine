module.exports = {
  restoreMocks: true,
  collectCoverage: true,
  testEnvironment: "node",
  watchPlugins: [
    "jest-watch-typeahead/filename",
    "jest-watch-typeahead/testname",
  ],
  setupFilesAfterEnv: ["jest-extended", "<rootDir>/jest.testSetup.js"],
  testRunner: "jasmine2",
};
