package org.json;

public class JSONTokener {
    private final String source;
    private int index;

    public JSONTokener(String source) {
        this.source = source != null ? source : "";
        this.index = 0;
    }

    public boolean more() {
        return index < source.length();
    }

    public char next() {
        return more() ? source.charAt(index++) : 0;
    }

    public char nextClean() throws JSONException {
        while (more()) {
            char c = next();
            if (c > ' ') {
                if (c == '/') {
                    if (more()) {
                        char nextC = source.charAt(index);
                        if (nextC == '/') {
                            // line comment
                            index++;
                            while (more() && next() != '\n') {}
                            continue;
                        } else if (nextC == '*') {
                            // block comment
                            index++;
                            while (more()) {
                                if (next() == '*' && more() && source.charAt(index) == '/') {
                                    index++;
                                    break;
                                }
                            }
                            continue;
                        }
                    }
                }
                return c;
            }
        }
        return 0;
    }

    public Object nextValue() throws JSONException {
        char c = nextClean();
        switch (c) {
            case '"':
            case '\'':
                return nextString(c);
            case '{':
                back();
                return new JSONObject(this);
            case '[':
                back();
                return new JSONArray(this);
            default:
                break;
        }

        StringBuilder sb = new StringBuilder();
        while (c >= ' ' && ",:]}/\\\"[{;=#".indexOf(c) < 0) {
            sb.append(c);
            c = next();
        }
        back();

        String s = sb.toString().trim();
        if (s.isEmpty()) {
            throw new JSONException("Missing value");
        }
        if (s.equalsIgnoreCase("true")) return Boolean.TRUE;
        if (s.equalsIgnoreCase("false")) return Boolean.FALSE;
        if (s.equalsIgnoreCase("null")) return JSONObject.NULL;

        // Try number
        try {
            if (s.indexOf('.') > -1 || s.indexOf('e') > -1 || s.indexOf('E') > -1) {
                return Double.valueOf(s);
            }
            long l = Long.parseLong(s);
            if (l <= Integer.MAX_VALUE && l >= Integer.MIN_VALUE) {
                return (int) l;
            }
            return l;
        } catch (Exception ignored) {
            return s;
        }
    }

    public String nextString(char quote) throws JSONException {
        StringBuilder sb = new StringBuilder();
        while (more()) {
            char c = next();
            switch (c) {
                case 0:
                case '\n':
                case '\r':
                    throw new JSONException("Unterminated string");
                case '\\':
                    c = next();
                    switch (c) {
                        case 'b': sb.append('\b'); break;
                        case 't': sb.append('\t'); break;
                        case 'n': sb.append('\n'); break;
                        case 'f': sb.append('\f'); break;
                        case 'r': sb.append('\r'); break;
                        case 'u':
                            try {
                                String hex = source.substring(index, index + 4);
                                index += 4;
                                sb.append((char) Integer.parseInt(hex, 16));
                            } catch (Exception e) {
                                throw new JSONException("Illegal escape in string: " + e.getMessage());
                            }
                            break;
                        default:
                            sb.append(c);
                    }
                    break;
                default:
                    if (c == quote) {
                        return sb.toString();
                    }
                    sb.append(c);
            }
        }
        throw new JSONException("Unterminated string");
    }

    public void back() {
        if (index > 0) index--;
    }
}
