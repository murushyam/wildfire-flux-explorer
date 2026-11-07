package org.wildfire.fluxexplorer;

import junit.framework.TestCase;
import org.wildfire.fluxexplorer.model.BurnZone;
import org.wildfire.fluxexplorer.model.FluxValue;
import org.wildfire.fluxexplorer.model.Site;
import org.wildfire.fluxexplorer.model.WildfireRiskReport;
import org.wildfire.fluxexplorer.service.WildfireRiskEstimator;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public class WildfireRiskEstimatorTest extends TestCase {

    private WildfireRiskEstimator estimator;
    private Site sampleSite;

    @Override
    protected void setUp() throws Exception {
        super.setUp();
        estimator = new WildfireRiskEstimator();

        Map<String, Double> preMetrics = new HashMap<>();
        preMetrics.put("SH", 60.0);
        preMetrics.put("LH", 90.0);
        preMetrics.put("GPP", 5.0);
        preMetrics.put("ET", 3.0);
        preMetrics.put("VPD", 2.0);
        preMetrics.put("AOD", 0.4);

        Map<String, Double> duringMetrics = new HashMap<>();
        duringMetrics.put("SH", 110.0);
        duringMetrics.put("LH", 50.0);
        duringMetrics.put("GPP", 2.0);
        duringMetrics.put("ET", 1.5);
        duringMetrics.put("VPD", 4.8);
        duringMetrics.put("AOD", 1.3);

        Map<String, FluxValue> values = new HashMap<>();
        values.put("pre", new FluxValue(preMetrics));
        values.put("during", new FluxValue(duringMetrics));

        sampleSite = new Site("test_site", "Test Biosphere", 22.0, 85.0, "Test Fire",
                0.8, 0.9, values, Collections.emptyList(),
                new BurnZone(0, 0, 5, "test"), "test");
    }

    public void testRiskDuringWildfirePhase() {
        WildfireRiskReport report = estimator.estimateRisk(sampleSite, "during");

        assertNotNull("Risk report must not be null", report);
        assertTrue("Risk score during wildfire should be >= 50", report.getRiskScore() >= 50.0);
        assertTrue("Category should be HIGH or EXTREME",
                report.getCategory() == WildfireRiskReport.RiskCategory.HIGH ||
                report.getCategory() == WildfireRiskReport.RiskCategory.EXTREME);

        assertTrue("Thermal anomaly factor should be elevated", report.getThermalAnomalyFactor() > 0.7);
        assertTrue("Atmospheric aridity factor should be high", report.getAtmosphericAridityFactor() > 0.8);
    }

    public void testRiskDuringPreFirePhase() {
        WildfireRiskReport report = estimator.estimateRisk(sampleSite, "pre");

        assertNotNull("Risk report must not be null", report);
        assertTrue("Pre-fire risk score should be significantly lower than during-fire",
                report.getRiskScore() < estimator.estimateRisk(sampleSite, "during").getRiskScore());
        assertTrue("Category should be MODERATE or LOW",
                report.getCategory() == WildfireRiskReport.RiskCategory.MODERATE ||
                report.getCategory() == WildfireRiskReport.RiskCategory.LOW);
    }
}
