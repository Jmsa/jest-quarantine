const mock = require("mock-fs");
const { saveResults, setupQuarantine, tearDownQuarantine } = require("./index");
const originalIt = Object.assign({}, it);

jest.useFakeTimers().setSystemTime(new Date("2020-01-20").getTime());

describe("saveResults", () => {
  it("writes a new file with the results when there are results to save", () => {
    mockFS();
    global.quarantineResults = [{ some: "details" }];
    saveResults();
    const fs = require("fs");
    const files = fs.readdirSync("quarantined-tests");
    expect(files).toEqual(["index.test.log"]);
    mock.restore();
  });
  it("does nothing if there are no results to save", () => {
    mockFS();
    saveResults();
    const fs = require("fs");
    const files = fs.readdirSync("quarantined-tests");
    expect(files).toEqual([]);
    mock.restore();
  });
  it("creates a new quarantine dir if one does not exist", () => {
    mock();
    const fs = require("fs");
    expect(fs.readdirSync("./")).toEqual([]);
    global.quarantineResults = [{ some: "details" }];
    saveResults();
    expect(fs.readdirSync("quarantined-tests")).toEqual(["index.test.log"]);
    mock.restore();
  });
});

describe("setupQuarantine", () => {
  it("adds a new empty tracking array to the global space", () => {
    setupQuarantine();
    expect(global.quarantineResults).toEqual([]);
    tearDownQuarantine();
  });
  it("adds a new quarantine methods to the global space", () => {
    expect(global.quarantine).toBeUndefined();
    expect(it.quarantine).toBeUndefined();
    expect(test.quarantine).toBeUndefined();
    setupQuarantine();
    expect(global.quarantine).toBeDefined();
    expect(it.quarantine).toBeDefined();
    expect(test.quarantine).toBeDefined();
    tearDownQuarantine();
  });
  it("replaces an existing tracking array with a new empty one", () => {
    global.quarantineResults = [{ "some file": "details" }];
    setupQuarantine();
    expect(global.quarantineResults).toEqual([]);
    tearDownQuarantine();
  });
});

describe("quarantine", () => {
  beforeEach(() => {
    mockFS();
    setupQuarantine();
    mockTest();
  });
  afterEach(() => {
    restoreTest();
    tearDownQuarantine();
    mock.restore();
  });
  it("works even without the global tracking being in place", () => {
    delete global.quarantineResults;
    quarantine("a test that passes", () => {
      expect(1).toBe(1);
    });
    quarantine("a test that fails", () => {
      expect(1).toBe(2);
    });
    expect(it.todo).toHaveBeenCalledTimes(1);
    expect(global.quarantineResults).toBeUndefined();
  });
  it("lets tests through that pass", () => {
    quarantine("a test that passes", () => {
      expect(1).toBe(1);
    });
    expect(it.todo).toHaveBeenCalledTimes(0);
    expect(global.quarantineResults).toEqual([
      {
        date: "2020-01-20T00:00:00.000Z",
        name: "a test that passes",
        passes: true,
        testPath: "index.test.js",
      },
    ]);
  });
  it("catches tests that would fail and marks them as todo/quarantined", () => {
    quarantine("a test that fails", () => {
      expect(1).toBe(2);
    });
    expect(it.todo).toHaveBeenCalledTimes(1);
    expect(it.todo).toHaveBeenCalledWith("a test that fails");
    expect(global.quarantineResults).toEqual([
      {
        date: "2020-01-20T00:00:00.000Z",
        name: "a test that fails",
        passes: false,
        testPath: "index.test.js",
      },
    ]);
  });
  it("when the expirationDate has passed it runs the test normally", () => {
    global.quarantineResults = [
      {
        name: "a test that fails ",
        passes: false,
        testPath: "index.test.js",
        date: "2020-01-01T00:00:00.000Z",
      },
    ];
    saveResults();
    quarantine("a test that fails ", "2019-01-01", () => {
      expect(1).toBe(2);
    });
    expect(it).toHaveBeenCalledTimes(1);
    expect(it).toHaveBeenCalledWith("a test that fails ", expect.any(Function));
    expect(it.todo).toHaveBeenCalledTimes(0);
    expect(global.quarantineResults).toEqual([
      {
        name: "a test that fails ",
        passes: false,
        testPath: "index.test.js",
        date: "2020-01-20T00:00:00.000Z",
      },
    ]);
  });
  it("when expirationDate hasn't passed it keeps the test in quarantine", () => {
    global.quarantineResults = [
      {
        name: "a test that fails",
        passes: false,
        testPath: "index.test.js",
        date: "2020-01-20T00:00:00.000Z",
      },
    ];
    saveResults();
    quarantine("a test that fails ", "2020-02-01", () => {
      expect(1).toBe(2);
    });
    expect(it.todo).toHaveBeenCalledTimes(1);
    expect(it.todo).toHaveBeenCalledWith("a test that fails ");
    expect(global.quarantineResults).toEqual([
      {
        name: "a test that fails ",
        passes: false,
        testPath: "index.test.js",
        date: "2020-01-20T00:00:00.000Z",
      },
    ]);
  });
  it("when there are previous results for the file but not the test", () => {
    global.quarantineResults = [
      {
        name: "a different test",
        passes: false,
        testPath: "index.test.js",
        date: "2020-01-01T00:00:00.000Z",
      },
    ];
    saveResults();
    quarantine("a test that fails", () => {
      expect(1).toBe(2);
    });
    expect(it.todo).toHaveBeenCalledTimes(1);
    expect(global.quarantineResults).toEqual([
      {
        name: "a test that fails",
        passes: false,
        testPath: "index.test.js",
        date: "2020-01-20T00:00:00.000Z",
      },
    ]);
  });

  it("does not merge new quarantine results with old ones", () => {
    global.quarantineResults = [
      {
        name: "a different test",
        passes: false,
        testPath: "index.test.js",
        date: "2020-01-01T00:00:00.000Z",
      },
    ];
    saveResults();
    quarantine("a test that fails", () => {
      expect(1).toBe(2);
    });
    saveResults();
    expect(it.todo).toHaveBeenCalledTimes(1);
    const fs = require("fs");
    const results = JSON.parse(
      fs.readFileSync("./quarantined-tests/index.test.log")
    );
    expect(results).toEqual([
      {
        name: "a test that fails",
        passes: false,
        testPath: "index.test.js",
        date: "2020-01-20T00:00:00.000Z",
      },
    ]);
  });
  it("removes stale logs if no quarantined results were encountered", () => {
    global.quarantineResults = [
      {
        name: "a stale test",
        passes: false,
        testPath: "index.test.js",
        date: "2020-01-01T00:00:00.000Z",
      },
    ];
    saveResults();
    const fs = require("fs");
    const initialResults = JSON.parse(
      fs.readFileSync("./quarantined-tests/index.test.log")
    );
    expect(initialResults).toEqual([
      {
        name: "a stale test",
        passes: false,
        testPath: "index.test.js",
        date: "2020-01-01T00:00:00.000Z",
      },
    ]);

    global.quarantineResults = [];
    saveResults();
    const fileExists = fs.existsSync("./quarantined-tests/index.test.log");
    expect(fileExists).toBe(false);
  });
  it("throws an error if trying to pass a number instead of a date", () => {
    expect(() =>
      quarantine(
        "a test that fails ",
        () => {
          expect(1).toBe(2);
        },
        1234
      )
    ).toThrow();
  });
  it("throws an error if trying to pass false instead of a date", () => {
    expect(() =>
      quarantine(
        "a test that fails ",
        () => {
          expect(1).toBe(2);
        },
        false
      )
    ).toThrow();
  });
  it("throws an error if trying to pass true instead of a date", () => {
    expect(() =>
      quarantine(
        "a test that fails ",
        () => {
          expect(1).toBe(2);
        },
        true
      )
    ).toThrow();
  });
  it("throws an error if trying to pass a string that is not a date", () => {
    expect(() =>
      quarantine(
        "a test that fails ",
        () => {
          expect(1).toBe(2);
        },
        "1234"
      )
    ).toThrow();
  });
  it.todo(
    "mocking time within a test function doesn't impact the quarantine date checking"
  );
});

const mockTest = () => {
  it = jest.fn();
  it.todo = jest.fn();
};
const restoreTest = () => (it = Object.assign({}, originalIt));

const mockFS = (customFiles = {}) => {
  mock({
    "./quarantined-tests/": {
      ...customFiles,
    },
  });
};
