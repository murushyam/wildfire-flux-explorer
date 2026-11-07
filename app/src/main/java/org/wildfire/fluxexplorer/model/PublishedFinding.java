package org.wildfire.fluxexplorer.model;

public class PublishedFinding {
    private final String text;
    private final String source;

    public PublishedFinding(String text, String source) {
        this.text = text;
        this.source = source;
    }

    public String getText() { return text; }
    public String getSource() { return source; }
}
