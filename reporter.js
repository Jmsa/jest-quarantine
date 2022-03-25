// This reporter aims to make it easier to be informed about test which have been quarantined
const path = require("path");
const cwd = process.cwd();

class QuarantineReporter {
  constructor(globalConfig, options) {
    this._options = {
      enabled: true,
      showTests: false,
      colorLevel: 2,
      logger: console,
      ...options,
    };
  }

  onRunComplete = async (context, results) => {
    return handleResults(results, this._options);
  };
}

const handleResults = async (results, options) => {
  const { enabled, showTests, logger, colorLevel } = options;
  if (enabled) {
    const chalk = require("chalk");
    const customChalk = new chalk.Instance({ level: colorLevel });

    // Get quarantined results
    const testsFilesRun = results.testResults.map((t) => t.testFilePath);
    const quarantinedTests = await combineLogs(testsFilesRun);

    // Post quarantine results
    const color =
      quarantinedTests.length > 0 ? customChalk.magenta : customChalk.white;
    const message =
      customChalk.white.bold("Quarantined:") +
      " " +
      color.bold(`${quarantinedTests.length} total`);
    logger.group(message);

    // If we want to be verbose loop over all of the quarantined tests and log the file/test/pass status
    if (showTests) {
      quarantinedTests.forEach((q) => {
        logger.log(customChalk.white.underline(q.testPath));
        logger.log(`--> ${q.name} - passes: ${q.passes}`);
      });
    }
    logger.groupEnd();
  }
};

const combineLogs = async (files) => {
  const fs = require("fs");
  let allLogs = [];

  // Get all of the logs for those files
  allLogs = files.map((f) => {
    const { name, dir } = path.parse(f);
    const testDir = dir.replace(cwd, "");
    return path.join(cwd, "quarantined-tests", testDir, `${name}.log`);
  });

  // Filter out any log files that don't actually exist
  allLogs = allLogs.filter((a) => {
    return fs.existsSync(a);
  });

  // Read each log and combine them into a single large array
  const quarantined = [];
  for await (const log of allLogs) {
    const quarantine = JSON.parse(fs.readFileSync(log));
    quarantined.push(...quarantine);
  }

  // Save the combined results
  fs.writeFileSync(
    path.join(cwd, "quarantined-tests", "combined-results.log"),
    JSON.stringify(quarantined, null, 4)
  );

  return quarantined;
};

module.exports = QuarantineReporter;
