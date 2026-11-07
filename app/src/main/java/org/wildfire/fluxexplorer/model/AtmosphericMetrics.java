package org.wildfire.fluxexplorer.model;

public class AtmosphericMetrics {
    private final double bowenRatio;
    private final double evaporativeFraction;
    private final double netTurbulentFlux;
    private final double carbonWaterRatio;
    private final double vpdStressIndex;

    public AtmosphericMetrics(double bowenRatio, double evaporativeFraction,
                              double netTurbulentFlux, double carbonWaterRatio,
                              double vpdStressIndex) {
        this.bowenRatio = bowenRatio;
        this.evaporativeFraction = evaporativeFraction;
        this.netTurbulentFlux = netTurbulentFlux;
        this.carbonWaterRatio = carbonWaterRatio;
        this.vpdStressIndex = vpdStressIndex;
    }

    public double getBowenRatio() { return bowenRatio; }
    public double getEvaporativeFraction() { return evaporativeFraction; }
    public double getNetTurbulentFlux() { return netTurbulentFlux; }
    public double getCarbonWaterRatio() { return carbonWaterRatio; }
    public double getVpdStressIndex() { return vpdStressIndex; }

    @Override
    public String toString() {
        return String.format("Bowen: %.2f | EvapFrac: %.2f | NetFlux: %.1f W/m² | WUE: %.2f | VPD Stress: %.2f",
                bowenRatio, evaporativeFraction, netTurbulentFlux, carbonWaterRatio, vpdStressIndex);
    }
}
