package org.wildfire.fluxexplorer.model;

public class BurnZone {
    private final double x;
    private final double z;
    private final double radius;
    private final String note;

    public BurnZone(double x, double z, double radius, String note) {
        this.x = x;
        this.z = z;
        this.radius = radius;
        this.note = note != null ? note : "";
    }

    public double getX() { return x; }
    public double getZ() { return z; }
    public double getRadius() { return radius; }
    public String getNote() { return note; }
}
