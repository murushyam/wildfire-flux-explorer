package org.wildfire.fluxexplorer;

import junit.framework.TestCase;
import org.wildfire.fluxexplorer.model.FluxValue;
import org.wildfire.fluxexplorer.model.Site;
import org.wildfire.fluxexplorer.service.PredictiveFluxModel;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public class PredictiveFluxModelTest extends TestCase {

    private PredictiveFluxModel model;
    private Site similipalSite;

    @Override
    protected void setUp() throws Exception {
        super.setUp();
        model = new PredictiveFluxModel();

        // Similipal values from sites.json
        Map<String, Double> pre = new HashMap<>();
        pre.put("GPP", 5.0);
        pre.put("ET", 3.0);
        pre.put("LH", 90.0);
        pre.put("SH", 60.0);
        pre.put("VPD", 2.0);
        pre.put("AOD", 0.4);

        Map<String, Double> during = new HashMap<>();
        during.put("GPP", 3.0);
        during.put("ET", 2.0);
        during.put("LH", 60.0);
        during.put("SH", 100.0);
        during.put("VPD", 4.0);
        during.put("AOD", 1.2);

        Map<String, Double> post = new HashMap<>();
        post.put("GPP", 4.0);
        post.put("ET", 2.5);
        post.put("LH", 75.0);
        post.put("SH", 75.0);
        post.put("VPD", 3.0);
        post.put("AOD", 0.6);

        Map<String, FluxValue> values = new HashMap<>();
        values.put("pre", new FluxValue(pre));
        values.put("during", new FluxValue(during));
        values.put("post", new FluxValue(post));

        similipalSite = new Site("similipal", "Similipal BR, Odisha", 21.9, 86.3, "wildfire",
                0.8, 0.9, values, Collections.emptyList(), null, "test");
    }

    public void testAssessImpactDeltas() {
        PredictiveFluxModel.FluxImpactAssessment impact = model.assessImpact(similipalSite);

        assertNotNull(impact);
        // Sensible Heat increases during fire: 100 - 60 = +40 W/m2
        assertEquals(40.0, impact.getDeltaSH(), 0.001);

        // Latent Heat drops during fire: 60 - 90 = -30 W/m2
        assertEquals(-30.0, impact.getDeltaLH(), 0.001);

        // Evapotranspiration drops during fire: 2.0 - 3.0 = -1.0 mm/d
        assertEquals(-1.0, impact.getDeltaET(), 0.001);

        // GPP drops during fire: 3.0 - 5.0 = -2.0 gC/m2/d
        assertEquals(-2.0, impact.getDeltaGPP(), 0.001);

        // AOD surges during fire: 1.2 - 0.4 = +0.8
        assertEquals(0.8, impact.getDeltaAOD(), 0.001);

        // Post-fire GPP recovers from 3.0 to 4.0 out of 2.0 lost -> 50% recovery
        assertEquals(50.0, impact.getGppRecoveryPercent(), 0.001);

        // Post-fire ET recovers from 2.0 to 2.5 out of 1.0 lost -> 50% recovery
        assertEquals(50.0, impact.getEtRecoveryPercent(), 0.001);
    }

    public void testProjectRecoveryTrajectory() {
        // Project at 6 months with k = 0.5
        Map<String, Double> projection = model.projectRecoveryTrajectory(similipalSite, 6.0, 0.5);

        assertNotNull(projection);
        assertTrue(projection.containsKey("GPP"));
        assertTrue(projection.containsKey("SH"));

        // GPP during was 3.0, post was 4.0. As t increases, GPP approaches 4.0
        double projGPP = projection.get("GPP");
        assertTrue("Projected GPP should be between during (3.0) and post (4.0)",
                projGPP >= 3.0 && projGPP <= 4.0);

        // SH during was 100, post was 75. As t increases, SH approaches 75
        double projSH = projection.get("SH");
        assertTrue("Projected SH should be between during (100.0) and post (75.0)",
                projSH <= 100.0 && projSH >= 75.0);
    }
}
