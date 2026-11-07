package org.wildfire.fluxexplorer.model;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public class FluxValue {
    private final Map<String, Double> metrics;

    public FluxValue(Map<String, Double> metrics) {
        this.metrics = new HashMap<>(metrics != null ? metrics : Collections.emptyMap());
    }

    public double get(String key) {
        Double val = metrics.get(key);
        return val != null ? val : 0.0;
    }

    public double getGPP() { return get("GPP"); }
    public double getET() { return get("ET"); }
    public double getLH() { return get("LH"); }
    public double getSH() { return get("SH"); }
    public double getVPD() { return get("VPD"); }
    public double getAOD() { return get("AOD"); }

    public Map<String, Double> getAllMetrics() {
        return Collections.unmodifiableMap(metrics);
    }
}
