package org.wildfire.fluxexplorer;

import junit.framework.TestCase;
import org.wildfire.fluxexplorer.model.AtmosphericMetrics;
import org.wildfire.fluxexplorer.model.FluxValue;
import org.wildfire.fluxexplorer.service.AtmosphericFluxProcessor;

import java.util.HashMap;
import java.util.Map;

public class AtmosphericFluxProcessorTest extends TestCase {

    private AtmosphericFluxProcessor processor;

    @Override
    protected void setUp() throws Exception {
        super.setUp();
        processor = new AtmosphericFluxProcessor();
    }

    public void testComputeMetricsNormalConditions() {
        Map<String, Double> metricsMap = new HashMap<>();
        metricsMap.put("SH", 60.0);
        metricsMap.put("LH", 90.0);
        metricsMap.put("GPP", 5.0);
        metricsMap.put("ET", 3.0);
        metricsMap.put("VPD", 2.0);
        metricsMap.put("AOD", 0.4);

        FluxValue flux = new FluxValue(metricsMap);
        AtmosphericMetrics result = processor.computeMetrics(flux);

        // Bowen Ratio = SH / LH = 60 / 90 = 0.6667
        assertEquals(0.6667, result.getBowenRatio(), 0.001);

        // Evaporative Fraction = LH / (SH + LH) = 90 / 150 = 0.60
        assertEquals(0.60, result.getEvaporativeFraction(), 0.001);

        // Net turbulent flux = SH + LH = 150
        assertEquals(150.0, result.getNetTurbulentFlux(), 0.001);

        // Carbon-water ratio = GPP / ET = 5 / 3 = 1.6667
        assertEquals(1.6667, result.getCarbonWaterRatio(), 0.001);

        // VPD stress = (2.0 - 1.0) / 4.0 = 0.25
        assertEquals(0.25, result.getVpdStressIndex(), 0.001);
    }

    public void testComputeMetricsWildfireDisturbanceConditions() {
        Map<String, Double> metricsMap = new HashMap<>();
        metricsMap.put("SH", 100.0); // elevated sensible heat
        metricsMap.put("LH", 50.0);  // depressed latent heat
        metricsMap.put("GPP", 2.5);  // impaired photosynthesis
        metricsMap.put("ET", 1.8);   // lowered transpiration
        metricsMap.put("VPD", 4.2);  // high atmospheric dryness
        metricsMap.put("AOD", 1.2);  // heavy smoke aerosols

        FluxValue flux = new FluxValue(metricsMap);
        AtmosphericMetrics result = processor.computeMetrics(flux);

        // Bowen Ratio = 100 / 50 = 2.0 (inverted energy partitioning during fire)
        assertEquals(2.0, result.getBowenRatio(), 0.001);
        assertTrue("Bowen ratio during wildfire should exceed 1.0", result.getBowenRatio() > 1.0);

        // Evaporative fraction = 50 / 150 = 0.3333
        assertEquals(0.3333, result.getEvaporativeFraction(), 0.001);

        // VPD stress = (4.2 - 1.0) / 4.0 = 3.2 / 4 = 0.80
        assertEquals(0.80, result.getVpdStressIndex(), 0.001);
    }

    public void testPercentageChange() {
        // Similipal paper findings: SH +32.7 W/m2, LH -33%
        double shPre = 60.0;
        double shDuring = 100.0;
        double shChange = processor.computePercentageChange(shPre, shDuring);
        assertEquals(66.667, shChange, 0.01);

        double lhPre = 90.0;
        double lhDuring = 60.0;
        double lhChange = processor.computePercentageChange(lhPre, lhDuring);
        assertEquals(-33.333, lhChange, 0.01);
    }
}
