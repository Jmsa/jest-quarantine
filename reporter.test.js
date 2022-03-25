const Reporter = require("./reporter");
const fs = require("fs");
const cwd = process.cwd();
const mock = require("mock-fs");

describe("reporter", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2020-01-20").getTime());
    mockFS();
  });
  afterEach(() => {
    restoreMocks();
    jest.useRealTimers();
  });

  it("doesn't report results when disabled", async () => {
    const reporter = new Reporter({}, { enabled: false, logger });
    await reporter.onRunComplete({}, []);
    expect(messages).toEqual([]);
  });

  it("reports counts", async () => {
    const reporter = new Reporter(
      {},
      { enabled: true, logger: logger, colorLevel: 0 }
    );
    const testResults = getResults();
    await reporter.onRunComplete({}, testResults);
    expect(messages).toEqual(["Quarantined: 3 total"]);
  });

  it("reports counts + file names when showTests is true", async () => {
    const reporter = new Reporter(
      {},
      { enabled: true, logger: logger, showTests: true, colorLevel: 0 }
    );
    const testResults = getResults();
    await reporter.onRunComplete({}, testResults);
    expect(messages).toEqual([
      "Quarantined: 3 total",
      "some/file.js",
      "--> a different test - passes: false",
      "another/file.js",
      "--> a test - passes: true",
      "yet/another/file.jsx",
      "--> something - passes: false",
    ]);
  });
  it("reports 0 when no logs match run results", async () => {
    const reporter = new Reporter(
      {},
      { enabled: true, logger: logger, showTests: true, colorLevel: 0 }
    );
    await reporter.onRunComplete({}, { testResults: [] });
    expect(messages).toEqual(["Quarantined: 0 total"]);
  });
  it("combines results into a single output file", async () => {
    const reporter = new Reporter(
      {},
      { enabled: true, logger: logger, showTests: true, colorLevel: 0 }
    );
    const testResults = getResults();
    await reporter.onRunComplete({}, testResults);
    expect(messages).toEqual([
      "Quarantined: 3 total",
      "some/file.js",
      "--> a different test - passes: false",
      "another/file.js",
      "--> a test - passes: true",
      "yet/another/file.jsx",
      "--> something - passes: false",
    ]);
    const combinedOutput = JSON.parse(
      fs.readFileSync("quarantined-tests/combined-results.log")
    );
    expect(combinedOutput).toEqual([
      {
        name: "a different test",
        passes: false,
        testPath: "some/file.js",
        date: "2020-01-01T00:00:00.000Z",
      },
      {
        name: "a test",
        passes: true,
        testPath: "another/file.js",
        date: "2020-01-01T00:00:00.000Z",
      },
      {
        name: "something",
        passes: false,
        testPath: "yet/another/file.jsx",
        date: "2020-01-01T00:00:00.000Z",
      },
    ]);
  });
  it("reports 0 if no test files were run", async () => {
    const reporter = new Reporter(
      {},
      { enabled: true, logger: logger, showTests: true, colorLevel: 0 }
    );
    await reporter.onRunComplete({}, { testResults: [] });
    expect(messages).toEqual(["Quarantined: 0 total"]);
  });
});

const getResults = () => {
  return {
    testResults: [
      { testFilePath: "some/file.js" },
      { testFilePath: "another/file.js" },
      { testFilePath: "yet/another/file.jsx" },
    ],
  };
};

const mockFS = () => {
  mock({
    "quarantined-tests/some/file.log": JSON.stringify([
      {
        name: "a different test",
        passes: false,
        testPath: "some/file.js",
        date: "2020-01-01T00:00:00.000Z",
      },
    ]),
    "quarantined-tests/another/file.log": JSON.stringify([
      {
        name: "a test",
        passes: true,
        testPath: "another/file.js",
        date: "2020-01-01T00:00:00.000Z",
      },
    ]),
    "quarantined-tests/yet/another/file.log": JSON.stringify([
      {
        name: "something",
        passes: false,
        testPath: "yet/another/file.jsx",
        date: "2020-01-01T00:00:00.000Z",
      },
    ]),
  });
};

let messages = [];
const logger = {
  log: (m) => messages.push(m),
  group: (m) => messages.push(m),
  groupEnd: () => {},
};

const restoreMocks = () => {
  messages = [];
  mock.restore();
};
