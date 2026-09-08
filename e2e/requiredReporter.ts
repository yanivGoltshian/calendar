import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

export default class RequiredReporter implements Reporter {
  private count = 0;
  private skipped = 0;
  onBegin(_config: FullConfig, suite: Suite) {
    this.count = suite.allTests().length;
  }
  onTestEnd(_test: TestCase, result: TestResult) {
    if (result.status === 'skipped') this.skipped++;
  }
  async onEnd(result: FullResult) {
    const minimum = Number(process.env.E2E_EXPECT_MINIMUM ?? 37);
    const floor = process.env.E2E_TARGETED === '1' ? 1 : 37;
    if (
      !Number.isInteger(minimum) ||
      minimum < floor ||
      this.count < minimum ||
      this.skipped > 0
    ) {
      console.error(
        `Required browser suite incomplete: ${this.count} collected; ${this.skipped} skipped; minimum ${minimum}`,
      );
      return { status: 'failed' as const };
    }
    return { status: result.status };
  }
}
