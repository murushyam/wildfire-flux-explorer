package org.wildfire.fluxexplorer.model;

public class FluxVariable {
    private final String id;
    private final String label;
    private final String unit;
    private final String direction;
    private final String color;

    public FluxVariable(String id, String label, String unit, String direction, String color) {
        this.id = id;
        this.label = label;
        this.unit = unit;
        this.direction = direction;
        this.color = color;
    }

    public String getId() { return id; }
    public String getLabel() { return label; }
    public String getUnit() { return unit; }
    public String getDirection() { return direction; }
    public String getColor() { return color; }
}
