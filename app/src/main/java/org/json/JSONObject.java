package org.json;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;

public class JSONObject {
    public static final Object NULL = new Object() {
        @Override
        public boolean equals(Object o) {
            return o == this || o == null;
        }

        @Override
        public String toString() {
            return "null";
        }
    };

    private final Map<String, Object> map = new LinkedHashMap<>();

    public JSONObject() {}

    public JSONObject(String source) throws JSONException {
        this(new JSONTokener(source));
    }

    public JSONObject(JSONTokener x) throws JSONException {
        char c = x.nextClean();
        if (c != '{') {
            throw new JSONException("A JSONObject text must begin with '{'");
        }
        while (true) {
            c = x.nextClean();
            switch (c) {
                case 0:
                    throw new JSONException("A JSONObject text must end with '}'");
                case '}':
                    return;
                default:
                    x.back();
                    String key = x.nextValue().toString();

                    c = x.nextClean();
                    if (c != ':') {
                        throw new JSONException("Expected a ':' after a key");
                    }
                    map.put(key, x.nextValue());

                    switch (x.nextClean()) {
                        case ';':
                        case ',':
                            if (x.nextClean() == '}') {
                                return;
                            }
                            x.back();
                            break;
                        case '}':
                            return;
                        default:
                            throw new JSONException("Expected a ',' or '}'");
                    }
            }
        }
    }

    public Object opt(String key) {
        return key != null ? map.get(key) : null;
    }

    public Object get(String key) throws JSONException {
        Object val = opt(key);
        if (val == null) {
            throw new JSONException("JSONObject[" + key + "] not found.");
        }
        return val;
    }

    public boolean optBoolean(String key, boolean fallback) {
        Object val = opt(key);
        if (val instanceof Boolean) return (Boolean) val;
        if (val instanceof String) {
            String s = (String) val;
            if ("true".equalsIgnoreCase(s)) return true;
            if ("false".equalsIgnoreCase(s)) return false;
        }
        return fallback;
    }

    public boolean optBoolean(String key) {
        return optBoolean(key, false);
    }

    public String optString(String key, String fallback) {
        Object val = opt(key);
        return (val != null && val != NULL) ? val.toString() : fallback;
    }

    public String optString(String key) {
        return optString(key, "");
    }

    public String getString(String key) throws JSONException {
        Object val = get(key);
        if (val != null && val != NULL) return val.toString();
        throw new JSONException("JSONObject[" + key + "] not a string.");
    }

    public double optDouble(String key, double fallback) {
        Object val = opt(key);
        if (val instanceof Number) return ((Number) val).doubleValue();
        if (val instanceof String) {
            try {
                return Double.parseDouble((String) val);
            } catch (Exception ignored) {}
        }
        return fallback;
    }

    public double optDouble(String key) {
        return optDouble(key, Double.NaN);
    }

    public double getDouble(String key) throws JSONException {
        Object val = get(key);
        if (val instanceof Number) return ((Number) val).doubleValue();
        try {
            return Double.parseDouble(val.toString());
        } catch (Exception e) {
            throw new JSONException("JSONObject[" + key + "] is not a double.");
        }
    }

    public JSONObject optJSONObject(String key) {
        Object val = opt(key);
        return val instanceof JSONObject ? (JSONObject) val : null;
    }

    public JSONObject getJSONObject(String key) throws JSONException {
        Object val = get(key);
        if (val instanceof JSONObject) return (JSONObject) val;
        throw new JSONException("JSONObject[" + key + "] is not a JSONObject.");
    }

    public JSONArray optJSONArray(String key) {
        Object val = opt(key);
        return val instanceof JSONArray ? (JSONArray) val : null;
    }

    public JSONArray getJSONArray(String key) throws JSONException {
        Object val = get(key);
        if (val instanceof JSONArray) return (JSONArray) val;
        throw new JSONException("JSONObject[" + key + "] is not a JSONArray.");
    }

    public Iterator<String> keys() {
        return map.keySet().iterator();
    }

    public boolean has(String key) {
        return map.containsKey(key);
    }
}
