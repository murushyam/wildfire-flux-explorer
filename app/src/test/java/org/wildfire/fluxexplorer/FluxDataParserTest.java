package org.wildfire.fluxexplorer;

import junit.framework.TestCase;
import org.wildfire.fluxexplorer.model.FluxValue;
import org.wildfire.fluxexplorer.model.FluxVariable;
import org.wildfire.fluxexplorer.model.Site;
import org.wildfire.fluxexplorer.service.FluxDataLoader;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.List;
import java.util.Map;

public class FluxDataParserTest extends TestCase {

    private FluxDataLoader loader;

    @Override
    protected void setUp() throws Exception {
        super.setUp();
        loader = new FluxDataLoader();
    }

    public void testParseSitesJson() throws Exception {
        File sitesFile = new File("src/main/assets/web/data/sites.json");
        if (!sitesFile.exists()) {
            sitesFile = new File("app/src/main/assets/web/data/sites.json");
        }
        if (!sitesFile.exists()) {
            sitesFile = new File("data/sites.json");
        }
        assertTrue("sites.json must exist at " + sitesFile.getAbsolutePath(), sitesFile.exists());

        try (InputStream is = new FileInputStream(sitesFile)) {
            loader.loadFromStream(is);
        }

        // Verify variables
        Map<String, FluxVariable> vars = loader.getVariables();
        assertTrue("Variables must contain GPP", vars.containsKey("GPP"));
        assertTrue("Variables must contain ET", vars.containsKey("ET"));
        assertTrue("Variables must contain LH", vars.containsKey("LH"));
        assertTrue("Variables must contain SH", vars.containsKey("SH"));
        assertTrue("Variables must contain VPD", vars.containsKey("VPD"));
        assertTrue("Variables must contain AOD", vars.containsKey("AOD"));

        assertEquals("Sensible heat flux", vars.get("SH").getLabel());
        assertEquals("W m-2", vars.get("SH").getUnit());
        assertEquals("up", vars.get("SH").getDirection());

        // Verify phases
        List<String> phases = loader.getPhases();
        assertEquals(3, phases.size());
        assertEquals("pre", phases.get(0));
        assertEquals("during", phases.get(1));
        assertEquals("post", phases.get(2));

        // Verify sites
        List<Site> sites = loader.getSites();
        assertFalse("Sites list should not be empty", sites.isEmpty());
        assertEquals(3, sites.size());

        Site similipal = loader.getSiteById("similipal");
        assertNotNull("Similipal site must exist", similipal);
        assertEquals("Similipal BR, Odisha", similipal.getName());
        assertEquals(21.9, similipal.getLat(), 0.001);
        assertEquals(86.3, similipal.getLon(), 0.001);
        assertEquals(0.8, similipal.getRelief(), 0.001);
        assertEquals(0.9, similipal.getForestDensity(), 0.001);

        // Verify flux values
        FluxValue preValues = similipal.getPhaseValues("pre");
        assertNotNull("Pre-fire values must exist", preValues);
        assertEquals(60.0, preValues.getSH(), 0.001);
        assertEquals(90.0, preValues.getLH(), 0.001);
        assertEquals(5.0, preValues.getGPP(), 0.001);
        assertEquals(3.0, preValues.getET(), 0.001);

        FluxValue duringValues = similipal.getPhaseValues("during");
        assertNotNull("During-fire values must exist", duringValues);
        assertEquals(100.0, duringValues.getSH(), 0.001);
        assertEquals(60.0, duringValues.getLH(), 0.001);

        // Verify burn zone
        assertNotNull("Burn zone must exist for Similipal", similipal.getBurnZone());
        assertEquals(1.5, similipal.getBurnZone().getX(), 0.001);
        assertEquals(5.0, similipal.getBurnZone().getRadius(), 0.001);

        // Verify published findings
        assertFalse("Published findings should exist for Similipal", similipal.getPublishedFindings().isEmpty());
    }
}
