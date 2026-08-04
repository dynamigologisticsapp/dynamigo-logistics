/**
 * Comprehensive Test Runner
 * 
 * Runs all optimization tests and generates detailed reports
 */

import { runComprehensiveTests } from "../server/comprehensive-tests";
import { formatOptimizationSummary } from "../server/optimization-logger";

async function main() {
  console.log("🚀 Starting Comprehensive Test Suite...\n");

  try {
    const { passed, failed, results, summary } = await runComprehensiveTests();

    // Print summary
    console.log(summary);

    // Print detailed results
    console.log("\n📋 DETAILED RESULTS:\n");
    for (const result of results) {
      const status = result.passed ? "✅" : "❌";
      console.log(`${status} ${result.name}`);
      if (result.stopCount) console.log(`   Stops: ${result.stopCount}`);
      if (result.depotCount) console.log(`   Depots: ${result.depotCount}`);
      if (result.jobsProcessed) console.log(`   Jobs: ${result.jobsProcessed}`);
      if (result.reason) console.log(`   Reason: ${result.reason}`);
    }

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Test runner failed:", error);
    process.exit(1);
  }
}

main();
