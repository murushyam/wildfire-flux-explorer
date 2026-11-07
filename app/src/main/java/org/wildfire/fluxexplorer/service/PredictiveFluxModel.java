package org.wildfire.fluxexplorer.service;

import org.wildfire.fluxexplorer.model.FluxValue;
import org.wildfire.fluxexplorer.model.Site;

import java.util.HashMap;
import java.util.Map;

public class PredictiveFluxModel {

    public static class FluxImpactAssessment {
        private final double deltaSH;
        private final double deltaLH;
        private final double deltaGPP;
        private final double deltaET;
        private final double deltaVPD;
        private final double deltaAOD;
        private final double gppRecoveryPercent;
        private final double etRecoveryPercent;

        public FluxImpactAssessment(double deltaSH, double deltaLH, double deltaGPP,
                                    double deltaET, double deltaVPD, double deltaAOD,
                                    double gppRecoveryPercent, double etRecoveryPercent) {
            this.deltaSH = deltaSH;
            this.deltaLH = deltaLH;
            this.deltaGPP = deltaGPP;
            this.deltaET = deltaET;
            this.deltaVPD = deltaVPD;
            this.deltaAOD = deltaAOD;
            this.gppRecoveryPercent = gppRecoveryPercent;
            this.etRecoveryPercent = etRecoveryPercent;
        }

        public double getDeltaSH() { return deltaSH; }
        public double getDeltaLH() { return deltaLH; }
        public double getDeltaGPP() { return deltaGPP; }
        public double getDeltaET() { return deltaET; }
        public double getDeltaVPD() { return deltaVPD; }
        public double getDeltaAOD() { return deltaAOD; }
        public double getGppRecoveryPercent() { return gppRecoveryPercent; }
        public double getEtRecoveryPercent() { return etRecoveryPercent; }
    }

    /**
     * Compute wildfire disturbance deltas (during vs pre) and recovery trajectories (post vs during).
     */
    public FluxImpactAssessment assessImpact(Site site) {
        if (site == null) {
            return new FluxImpactAssessment(0, 0, 0, 0, 0, 0, 0, 0);
        }

        FluxValue pre = site.getPhaseValues("pre");
        FluxValue during = site.getPhaseValues("during");
        FluxValue post = site.getPhaseValues("post");

        if (pre == null || during == null) {
            return new FluxImpactAssessment(0, 0, 0, 0, 0, 0, 0, 0);
        }

        double dSH = during.getSH() - pre.getSH();
        double dLH = during.getLH() - pre.getLH();
        double dGPP = during.getGPP() - pre.getGPP();
        double dET = during.getET() - pre.getET();
        double dVPD = during.getVPD() - pre.getVPD();
        double dAOD = during.getAOD() - pre.getAOD();

        double gppRec = 0.0;
        double etRec = 0.0;
        if (post != null) {
            double gppLost = pre.getGPP() - during.getGPP();
            if (gppLost > 0.001) {
                gppRec = ((post.getGPP() - during.getGPP()) / gppLost) * 100.0;
            } else {
                gppRec = 100.0;
            }

            double etLost = pre.getET() - during.getET();
            if (etLost > 0.001) {
                etRec = ((post.getET() - during.getET()) / etLost) * 100.0;
            } else {
                etRec = 100.0;
            }
        }

        return new FluxImpactAssessment(dSH, dLH, dGPP, dET, dVPD, dAOD, gppRec, etRec);
    }

    /**
     * Projects future flux trajectory at month t post-fire using an asymptotic exponential recovery model.
     * Value(t) = During + (Post - During) * (1 - exp(-k * t))
     */
    public Map<String, Double> projectRecoveryTrajectory(Site site, double monthsPostFire, double recoveryConstantK) {
        Map<String, Double> projection = new HashMap<>();
        if (site == null) return projection;

        FluxValue during = site.getPhaseValues("during");
        FluxValue post = site.getPhaseValues("post");
        if (during == null || post == null) return projection;

        double factor = 1.0 - Math.exp(-recoveryConstantK * Math.max(0.0, monthsPostFire));

        for (String metric : during.getAllMetrics().keySet()) {
            double vDuring = during.get(metric);
            double vPost = post.get(metric);
            double projected = vDuring + (vPost - vDuring) * factor;
            projection.put(metric, projected);
        }
        return projection;
    }
}
