package org.wildfire.fluxexplorer;

import junit.framework.TestCase;
import org.wildfire.fluxexplorer.model.Site;
import org.wildfire.fluxexplorer.service.HotspotExplorer;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class HotspotExplorerTest extends TestCase {

    private HotspotExplorer explorer;
    private List<Site> testSites;

    @Override
    protected void setUp() throws Exception {
        super.setUp();
        explorer = new HotspotExplorer();
        testSites = new ArrayList<>();

        // Similipal, Odisha (21.9 N, 86.3 E, relief 0.8)
        testSites.add(new Site("similipal", "Similipal BR, Odisha", 21.9, 86.3, "event", 0.8, 0.9,
                Collections.emptyMap(), Collections.emptyList(), null, ""));

        // Bandhavgarh, MP (23.7 N, 81.0 E, relief 0.5)
        testSites.add(new Site("bandhavgarh", "Bandhavgarh, MP", 23.7, 81.0, "event", 0.5, 0.7,
                Collections.emptyMap(), Collections.emptyList(), null, ""));

        // Chamba, HP (32.55 N, 76.13 E, relief 1.4)
        testSites.add(new Site("chamba", "Chamba, HP", 32.55, 76.13, "event", 1.4, 0.6,
                Collections.emptyMap(), Collections.emptyList(), null, ""));
    }

    public void testFilterByBoundingBox() {
        // Eastern India box: lat 20 to 25, lon 84 to 88 -> should match only Similipal
        List<Site> eastern = explorer.filterByBoundingBox(testSites, 20.0, 25.0, 84.0, 88.0);
        assertEquals(1, eastern.size());
        assertEquals("similipal", eastern.get(0).getId());

        // Northern India box: lat 30 to 35, lon 75 to 80 -> should match only Chamba
        List<Site> northern = explorer.filterByBoundingBox(testSites, 30.0, 35.0, 75.0, 80.0);
        assertEquals(1, northern.size());
        assertEquals("chamba", northern.get(0).getId());
    }

    public void testFilterByRelief() {
        // High relief (>= 0.7): Similipal (0.8) and Chamba (1.4)
        List<Site> highRelief = explorer.filterByRelief(testSites, 0.7);
        assertEquals(2, highRelief.size());

        // Extreme mountainous relief (>= 1.0): only Chamba
        List<Site> mountain = explorer.filterByRelief(testSites, 1.0);
        assertEquals(1, mountain.size());
        assertEquals("chamba", mountain.get(0).getId());
    }

    public void testHaversineDistanceAndNearest() {
        // Near Bhubaneswar, Odisha (20.3 N, 85.8 E) -> nearest site is Similipal
        Site nearest = explorer.findNearestSite(testSites, 20.3, 85.8);
        assertNotNull(nearest);
        assertEquals("similipal", nearest.getId());

        double distSimilipal = explorer.calculateDistanceKm(20.3, 85.8, 21.9, 86.3);
        assertTrue("Distance to Similipal should be ~180-220 km", distSimilipal > 150.0 && distSimilipal < 250.0);
    }
}
