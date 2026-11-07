package org.wildfire.fluxexplorer;

import junit.framework.AssertionFailedError;
import junit.framework.Test;
import junit.framework.TestListener;
import junit.framework.TestResult;
import junit.framework.TestSuite;

public class TestRunner {

    public static void main(String[] args) {
        System.out.println("====================================================");
        System.out.println("   WILDFIRE FLUX EXPLORER - AUTOMATED TEST SUITE    ");
        System.out.println("====================================================");

        TestSuite suite = new TestSuite();
        suite.addTestSuite(FluxDataParserTest.class);
        suite.addTestSuite(AtmosphericFluxProcessorTest.class);
        suite.addTestSuite(WildfireRiskEstimatorTest.class);
        suite.addTestSuite(HotspotExplorerTest.class);
        suite.addTestSuite(PredictiveFluxModelTest.class);

        long startTime = System.currentTimeMillis();

        TestResult result = new TestResult();
        result.addListener(new TestListener() {
            @Override
            public void startTest(Test test) {
                System.out.println(" [RUNNING]  " + test.toString());
            }

            @Override
            public void endTest(Test test) {
                System.out.println(" [PASSED]   " + test.toString());
            }

            @Override
            public void addError(Test test, Throwable t) {
                System.err.println(" [ERROR]    " + test.toString() + ": " + t.getMessage());
            }

            @Override
            public void addFailure(Test test, AssertionFailedError t) {
                System.err.println(" [FAILURE]  " + test.toString() + ": " + t.getMessage());
            }
        });

        suite.run(result);

        long duration = System.currentTimeMillis() - startTime;

        System.out.println();
        System.out.println("====================================================");
        System.out.println(String.format("Tests run: %d, Failures: %d, Errors: %d (Time: %.3fs)",
                result.runCount(), result.failureCount(), result.errorCount(), duration / 1000.0));
        System.out.println("====================================================");

        if (result.wasSuccessful()) {
            System.out.println("BUILD SUCCESSFUL: ALL AUTOMATED TESTS PASSED CLEANLY!");
            System.exit(0);
        } else {
            System.err.println("BUILD FAILED: TEST FAILURES ENCOUNTERED!");
            System.exit(1);
        }
    }
}
