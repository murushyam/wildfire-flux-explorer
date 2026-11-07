package org.wildfire.fluxexplorer.model;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public class Site {
    private final String id;
    private final String name;
    private final double lat;
    private final double lon;
    private final String event;
    private final double relief;
    private final double forestDensity;
    private final Map<String, FluxValue> values;
    private final List<PublishedFinding> publishedFindings;
    private final BurnZone burnZone;
    private final String source;

    public Site(String id, String name, double lat, double lon, String event,
                double relief, double forestDensity,
                Map<String, FluxValue> values,
                List<PublishedFinding> publishedFindings,
                BurnZone burnZone,
                String source) {
        this.id = id;
        this.name = name;
        this.lat = lat;
        this.lon = lon;
        this.event = event;
        this.relief = relief;
        this.forestDensity = forestDensity;
        this.values = values != null ? values : Collections.emptyMap();
        this.publishedFindings = publishedFindings != null ? publishedFindings : Collections.emptyList();
        this.burnZone = burnZone;
        this.source = source != null ? source : "";
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public double getLat() { return lat; }
    public double getLon() { return lon; }
    public String getEvent() { return event; }
    public double getRelief() { return relief; }
    public double getForestDensity() { return forestDensity; }
    public FluxValue getPhaseValues(String phase) { return values.get(phase); }
    public Map<String, FluxValue> getAllValues() { return Collections.unmodifiableMap(values); }
    public List<PublishedFinding> getPublishedFindings() { return Collections.unmodifiableList(publishedFindings); }
    public BurnZone getBurnZone() { return burnZone; }
    public String getSource() { return source; }
}
