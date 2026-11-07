package org.json;

import java.util.ArrayList;
import java.util.List;

public class JSONArray {
    private final List<Object> list = new ArrayList<>();

    public JSONArray() {}

    public JSONArray(String source) throws JSONException {
        this(new JSONTokener(source));
    }

    public JSONArray(JSONTokener x) throws JSONException {
        if (x.nextClean() != '[') {
            throw new JSONException("A JSONArray text must start with '['");
        }
        if (x.nextClean() != ']') {
            x.back();
            while (true) {
                if (x.nextClean() == ',') {
                    x.back();
                    list.add(JSONObject.NULL);
                } else {
                    x.back();
                    list.add(x.nextValue());
                }
                switch (x.nextClean()) {
                    case ';':
                    case ',':
                        if (x.nextClean() == ']') {
                            return;
                        }
                        x.back();
                        break;
                    case ']':
                        return;
                    default:
                        throw new JSONException("Expected a ',' or ']'");
                }
            }
        }
    }

    public int length() {
        return list.size();
    }

    public Object opt(int index) {
        return (index < 0 || index >= length()) ? null : list.get(index);
    }

    public Object get(int index) throws JSONException {
        Object val = opt(index);
        if (val == null) {
            throw new JSONException("JSONArray[" + index + "] not found.");
        }
        return val;
    }

    public String optString(int index, String fallback) {
        Object val = opt(index);
        return (val != null && val != JSONObject.NULL) ? val.toString() : fallback;
    }

    public String optString(int index) {
        return optString(index, "");
    }

    public String getString(int index) throws JSONException {
        Object val = get(index);
        if (val != null && val != JSONObject.NULL) return val.toString();
        throw new JSONException("JSONArray[" + index + "] is not a string.");
    }

    public JSONObject optJSONObject(int index) {
        Object val = opt(index);
        return val instanceof JSONObject ? (JSONObject) val : null;
    }

    public JSONObject getJSONObject(int index) throws JSONException {
        Object val = get(index);
        if (val instanceof JSONObject) return (JSONObject) val;
        throw new JSONException("JSONArray[" + index + "] is not a JSONObject.");
    }
}
