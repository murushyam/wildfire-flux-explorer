package org.wildfire.fluxexplorer.model;

public class WildfireRiskReport {
    public enum RiskCategory {
        LOW,
        MODERATE,
        HIGH,
        EXTREME
    }

    private final double riskScore;
    private final RiskCategory category;
    private final double thermalAnomalyFactor;
    private final double atmosphericAridityFactor;
    private final String description;

    public WildfireRiskReport(double riskScore, RiskCategory category,
                              double thermalAnomalyFactor, double atmosphericAridityFactor,
                              String description) {
        this.riskScore = riskScore;
        this.category = category;
        this.thermalAnomalyFactor = thermalAnomalyFactor;
        this.atmosphericAridityFactor = atmosphericAridityFactor;
        this.description = description;
    }

    public double getRiskScore() { return riskScore; }
    public RiskCategory getCategory() { return category; }
    public double getThermalAnomalyFactor() { return thermalAnomalyFactor; }
    public double getAtmosphericAridityFactor() { return atmosphericAridityFactor; }
    public String getDescription() { return description; }

    @Override
    public String toString() {
        return String.format("Risk: %s (%.1f/100) - %s [Thermal: %.2f, Aridity: %.2f]",
                category.name(), riskScore, description, thermalAnomalyFactor, atmosphericAridityFactor);
    }
}
