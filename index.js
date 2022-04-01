const fs = require("fs");
const path = require("path");
const cwd = process.cwd();
const { isMatch, differenceInCalendarDays } = require("date-fns");

// Check to see if quarantine has expired between the current run and the date provided
const hasQuarantineExpired = (runDate, expirationDate) => {
  const diff = differenceInCalendarDays(runDate, new Date(expirationDate));
  return diff >= 0;
};

// TODOs:
// - make an async/done version
/**
 * Wrap tests in a try/catch - marking them as "todo" when failed and logging them for reporting/later use either way.
 *
 * @param {string} name The name of your test
 * @param {(string|function)} expirationOrTest The function for your test or expiration date (yyyy-MM-dd) if using that. If no date is provided the quarantine lasts forever.
 * @param {function} fn The function for your test if providing an expiration date
 */
function quarantine(name, expirationOrTest, fn = null) {
  // Check if "expirationDate" is a function and fn is missing.
  // If so it is likely that no date was provided it should be treated as the function.
  if (typeof expirationOrTest === "function" && fn === null) {
    fn = expirationOrTest;
    expirationOrTest = null;
  }

  // If there is an expiration date then make sure it is valid
  if (expirationOrTest !== null && !isMatch(expirationOrTest, "yyyy-MM-dd")) {
    throw new Error(
      `quarantine: expirationDate must be a date string like "yyyy-MM-dd", instead it was passed:${expirationOrTest}`
    );
  }

  // Get the run date and name of the current test
  const now = new Date();
  const currentSpec = expect.getState();
  let passes;

  try {
    // Check to see if the test function passes
    fn();
    passes = true;
  } catch (e) {
    // If it doesn't then replace it with a todo so it's still tracked without needing to write a custom reporter
    passes = false;

    // TODO: circle back here - is it better to just not call "todo" at all and let the test disappear from counts??
    if (
      expirationOrTest !== null &&
      hasQuarantineExpired(now, expirationOrTest)
    ) {
      it(name, fn);
    } else {
      it.todo(`${name}`);
    }
  }

  // If we are keeping track of the results push these new ones to the array
  if (global.quarantineResults) {
    const testPath = path.relative(cwd, currentSpec.testPath);
    // ? Note: we don't have access to the suite or test full name
    global.quarantineResults.push({
      name,
      passes,
      testPath,
      date: now.toISOString(),
    });
  }
}

// Save quarantined test output
const saveResults = () => {
  const { quarantineResults } = global;
  if (quarantineResults && quarantineResults.length > 0) {
    let finalResults = [];

    // Grab details about the test file and check to see if there were any other results for this file
    const currentSpec = expect.getState();
    const { name, dir } = path.parse(currentSpec?.testPath);
    if (!fs.existsSync("./quarantined-tests/"))
      fs.mkdirSync("./quarantined-tests/");
    const testDir = dir.replace(cwd, "");
    const filePath = path.join(
      cwd,
      "quarantined-tests",
      testDir,
      `${name}.log`
    );

    // If there were previous results concat the new ones with them - preferring to keep the older cases of the same test
    if (fs.existsSync(filePath)) {
      const previousResults = JSON.parse(fs.readFileSync(filePath, "utf8"));
      finalResults = previousResults.concat(
        quarantineResults.filter(
          ({ name }) => !previousResults.find((p) => p.name == name)
        )
      );
    } else {
      finalResults = quarantineResults;
    }

    // Make sure the directory(ies) exist we need to have in order to save the log and then save it.
    ensureDirectoryExistence(filePath);
    fs.writeFileSync(filePath, JSON.stringify(finalResults, null, 4));
    global.quarantineResults = [];
  }
};

// Recursively build directories based on a provided path.
function ensureDirectoryExistence(filePath) {
  var dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

// Add the quarantine method and tracking array to the appropriate places in the global space
const setupQuarantine = () => {
  global.quarantine = quarantine;
  test.quarantine = quarantine;
  it.quarantine = quarantine;
  global.quarantineResults = [];

  // Add the call to saveResults here
  global.afterAll(async () => {
    saveResults();
  });

  // ? Note: this would be a good place to patch the jasmine reporter to get suite details
  // but that process has a few issues:
  // - jasmine2 is no longer the default runner for jest, jest-circus is
  // - jest-circus has no methods yet for expose the same suite details
  // - even when patching jasmine2 the order of execution means that every reporter runs after
  // the work is done and so can't inject suite details into the global scope
};

// Clean up any added global methods as well as the tracking array
// In normal usage this should not be needed but makes life easier when writing tests
const tearDownQuarantine = () => {
  delete global.quarantine;
  delete test.quarantine;
  delete it.quarantine;
  delete global.quarantineResults;
};

module.exports = {
  quarantine,
  saveResults,
  setupQuarantine,
  tearDownQuarantine,
};
