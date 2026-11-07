package org.wildfire.fluxexplorer.service;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.wildfire.fluxexplorer.model.BurnZone;
import org.wildfire.fluxexplorer.model.FluxValue;
import org.wildfire.fluxexplorer.model.FluxVariable;
import org.wildfire.fluxexplorer.model.PublishedFinding;
import org.wildfire.fluxexplorer.model.Site;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

public class FluxDataLoader {
    private final Map<String, FluxVariable> variables = new HashMap<>();
    private final List<String> phases = new ArrayList<>();
    private final List<Site> sites = new ArrayList<>();
    private boolean isExample = true;

    public void loadFromJsonString(String jsonContent) throws JSONException {
        JSONObject root = new JSONObject(jsonContent);
        isExample = root.optBoolean("is_example", true);

        // Variables
        variables.clear();
        JSONObject varsObj = root.optJSONObject("variables");
        if (varsObj != null) {
            Iterator<String> keys = varsObj.keys();
            while (keys.hasNext()) {
                String varId = keys.next();
                JSONObject v = varsObj.getJSONObject(varId);
                variables.put(varId, new FluxVariable(
                        varId,
                        v.optString("label", varId),
                        v.optString("unit", ""),
                        v.optString("direction", "none"),
                        v.optString("color", "#FFFFFF")
                ));
            }
        }

        // Phases
        phases.clear();
        JSONArray phasesArray = root.optJSONArray("phases");
        if (phasesArray != null) {
            for (int i = 0; i < phasesArray.length(); i++) {
                phases.add(phasesArray.getString(i));
            }
        }

        // Sites
        sites.clear();
        JSONArray sitesArray = root.optJSONArray("sites");
        if (sitesArray != null) {
            for (int i = 0; i < sitesArray.length(); i++) {
                JSONObject sObj = sitesArray.getJSONObject(i);
                String id = sObj.optString("id");
                String name = sObj.optString("name");
                double lat = sObj.optDouble("lat", 0.0);
                double lon = sObj.optDouble("lon", 0.0);
                String event = sObj.optString("event");
                double relief = sObj.optDouble("relief", 0.0);
                double forestDensity = sObj.optDouble("forest_density", 0.0);
                String source = sObj.optString("source", "");

                // Values per phase
                Map<String, FluxValue> valuesMap = new HashMap<>();
                JSONObject valuesObj = sObj.optJSONObject("values");
                if (valuesObj != null) {
                    Iterator<String> pKeys = valuesObj.keys();
                    while (pKeys.hasNext()) {
                        String p = pKeys.next();
                        JSONObject mObj = valuesObj.getJSONObject(p);
                        Map<String, Double> m = new HashMap<>();
                        Iterator<String> metricKeys = mObj.keys();
                        while (metricKeys.hasNext()) {
                            String mk = metricKeys.next();
                            m.put(mk, mObj.optDouble(mk, 0.0));
                        }
                        valuesMap.put(p, new FluxValue(m));
                    }
                }

                // Published findings
                List<PublishedFinding> findings = new ArrayList<>();
                JSONArray findingsArray = sObj.optJSONArray("published_findings");
                if (findingsArray != null) {
                    for (int j = 0; j < findingsArray.length(); j++) {
                        JSONObject fObj = findingsArray.getJSONObject(j);
                        findings.add(new PublishedFinding(
                                fObj.optString("text"),
                                fObj.optString("source")
                        ));
                    }
                }

                // Burn zone
                BurnZone burnZone = null;
                JSONObject bzObj = sObj.optJSONObject("burn_zone");
                if (bzObj != null) {
                    burnZone = new BurnZone(
                            bzObj.optDouble("x", 0.0),
                            bzObj.optDouble("z", 0.0),
                            bzObj.optDouble("r", 0.0),
                            bzObj.optString("note", "")
                    );
                }

                sites.add(new Site(id, name, lat, lon, event, relief, forestDensity, valuesMap, findings, burnZone, source));
            }
        }
    }

    public void loadFromStream(InputStream is) throws IOException, JSONException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append('\n');
            }
        }
        loadFromJsonString(sb.toString());
    }

    public Map<String, FluxVariable> getVariables() { return variables; }
    public List<String> getPhases() { return phases; }
    public List<Site> getSites() { return sites; }
    public boolean isExampleData() { return isExample; }

    public Site getSiteById(String id) {
        for (Site s : sites) {
            if (s.getId().equalsIgnoreCase(id)) return s;
        }
        return null;
    }
}
