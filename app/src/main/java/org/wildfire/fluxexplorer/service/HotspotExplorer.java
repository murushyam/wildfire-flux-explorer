package org.wildfire.fluxexplorer.service;

import org.wildfire.fluxexplorer.model.Site;

import java.util.ArrayList;
import java.util.List;

public class HotspotExplorer {

    /**
     * Filter sites located within a geographic bounding box [minLat, maxLat] and [minLon, maxLon].
     */
    public List<Site> filterByBoundingBox(List<Site> sites, double minLat, double maxLat, double minLon, double maxLon) {
        List<Site> filtered = new ArrayList<>();
        if (sites == null) return filtered;

        for (Site s : sites) {
            if (s.getLat() >= minLat && s.getLat() <= maxLat &&
                s.getLon() >= minLon && s.getLon() <= maxLon) {
                filtered.add(s);
            }
        }
        return filtered;
    }

    /**
     * Filter sites having terrain relief at or above threshold.
     */
    public List<Site> filterByRelief(List<Site> sites, double minRelief) {
        List<Site> filtered = new ArrayList<>();
        if (sites == null) return filtered;

        for (Site s : sites) {
            if (s.getRelief() >= minRelief) {
                filtered.add(s);
            }
        }
        return filtered;
    }

    /**
     * Calculate great-circle distance in kilometers using the Haversine formula.
     */
    public double calculateDistanceKm(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371.0; // Earth radius in kilometers
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                   Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Find nearest site from a given geographic coordinate.
     */
    public Site findNearestSite(List<Site> sites, double lat, double lon) {
        if (sites == null || sites.isEmpty()) return null;

        Site nearest = null;
        double minDistance = Double.MAX_VALUE;

        for (Site s : sites) {
            double dist = calculateDistanceKm(lat, lon, s.getLat(), s.getLon());
            if (dist < minDistance) {
                minDistance = dist;
                nearest = s;
            }
        }
        return nearest;
    }
}
