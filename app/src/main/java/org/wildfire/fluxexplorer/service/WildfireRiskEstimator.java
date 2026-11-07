package org.wildfire.fluxexplorer.service;

import org.wildfire.fluxexplorer.model.FluxValue;
import org.wildfire.fluxexplorer.model.Site;
import org.wildfire.fluxexplorer.model.WildfireRiskReport;

public class WildfireRiskEstimator {

    /**
     * Estimates wildfire danger and atmospheric anomaly intensity based on flux parameters,
     * terrain relief, and forest density.
     */
    public WildfireRiskReport estimateRisk(Site site, String phase) {
        if (site == null) {
            return new WildfireRiskReport(0.0, WildfireRiskReport.RiskCategory.LOW, 0.0, 0.0, "No site data");
        }

        FluxValue flux = site.getPhaseValues(phase);
        if (flux == null) {
            return new WildfireRiskReport(0.0, WildfireRiskReport.RiskCategory.LOW, 0.0, 0.0, "No phase data");
        }

        double sh = flux.getSH();
        double vpd = flux.getVPD();
        double aod = flux.getAOD();
        double lh = flux.getLH();
        double forestDensity = site.getForestDensity();
        double relief = site.getRelief();

        // 1. Thermal Anomaly Index: driven by high Sensible Heat Flux (SH) and low Latent Heat (LH)
        // Normal baseline SH is typically 50-70 W/m2; wildfire elevates it above 100-145 W/m2
        double thermalFactor = Math.min(1.0, Math.max(0.0, (sh - 40.0) / 80.0));

        // 2. Atmospheric Aridity Index: high VPD (> 2.5 kPa) coupled with reduced ET
        double aridityFactor = Math.min(1.0, Math.max(0.0, vpd / 5.0));

        // 3. Particulate/Smoke Factor: high AOD (> 0.5 indicates heavy aerosol load)
        double smokeFactor = Math.min(1.0, Math.max(0.0, aod / 1.5));

        // 4. Fuel & Topography Factor: forest density and terrain steepness facilitate flame propagation
        double fuelTerrainFactor = (forestDensity * 0.6) + (Math.min(1.0, relief) * 0.4);

        // Weighted Risk Score (0 - 100)
        double score = (thermalFactor * 35.0) +
                       (aridityFactor * 30.0) +
                       (smokeFactor * 20.0) +
                       (fuelTerrainFactor * 15.0);

        WildfireRiskReport.RiskCategory category;
        String desc;
        if (score >= 75.0) {
            category = WildfireRiskReport.RiskCategory.EXTREME;
            desc = "Extreme wildfire intensity with intense thermal plumes and severe atmospheric aridity";
        } else if (score >= 50.0) {
            category = WildfireRiskReport.RiskCategory.HIGH;
            desc = "High fire danger with elevated sensible heat flux and atmospheric drying";
        } else if (score >= 25.0) {
            category = WildfireRiskReport.RiskCategory.MODERATE;
            desc = "Moderate atmospheric disturbance and mild thermal anomaly";
        } else {
            category = WildfireRiskReport.RiskCategory.LOW;
            desc = "Low wildfire activity; baseline equilibrium atmosphere-biosphere exchange";
        }

        return new WildfireRiskReport(score, category, thermalFactor, aridityFactor, desc);
    }
}
