package org.wildfire.fluxexplorer.service;

import org.wildfire.fluxexplorer.model.AtmosphericMetrics;
import org.wildfire.fluxexplorer.model.FluxValue;

public class AtmosphericFluxProcessor {

    /**
     * Compute derived atmospheric and surface energy flux metrics for a given flux observation.
     */
    public AtmosphericMetrics computeMetrics(FluxValue flux) {
        if (flux == null) {
            return new AtmosphericMetrics(0, 0, 0, 0, 0);
        }

        double sh = flux.getSH();
        double lh = flux.getLH();
        double gpp = flux.getGPP();
        double et = flux.getET();
        double vpd = flux.getVPD();

        // Bowen Ratio = Sensible Heat Flux / Latent Heat Flux (SH / LH)
        double bowenRatio = lh != 0.0 ? sh / lh : (sh > 0 ? 99.9 : 0.0);

        // Evaporative Fraction = LH / (SH + LH)
        double totalTurbulent = sh + lh;
        double evaporativeFraction = totalTurbulent > 0.0 ? lh / totalTurbulent : 0.0;

        // Water Use Efficiency / Carbon-Water ratio = GPP / ET
        double carbonWaterRatio = et > 0.0 ? gpp / et : 0.0;

        // VPD Stress Index: normalized atmospheric aridity stress index [0.0 - 1.0]
        // VPD > 1.0 kPa indicates rising atmospheric thirst, with > 4.0 kPa representing extreme stress
        double vpdStress = Math.min(1.0, Math.max(0.0, (vpd - 1.0) / 4.0));

        return new AtmosphericMetrics(bowenRatio, evaporativeFraction, totalTurbulent, carbonWaterRatio, vpdStress);
    }

    /**
     * Compute relative change percentage between baseline (pre-fire) and target phase.
     */
    public double computePercentageChange(double baseline, double target) {
        if (baseline == 0.0) {
            return target == 0.0 ? 0.0 : 100.0;
        }
        return ((target - baseline) / Math.abs(baseline)) * 100.0;
    }
}
