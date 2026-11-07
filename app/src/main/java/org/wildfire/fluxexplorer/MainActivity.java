package org.wildfire.fluxexplorer;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.ProgressBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import org.wildfire.fluxexplorer.model.AtmosphericMetrics;
import org.wildfire.fluxexplorer.model.FluxValue;
import org.wildfire.fluxexplorer.model.Site;
import org.wildfire.fluxexplorer.model.WildfireRiskReport;
import org.wildfire.fluxexplorer.service.AtmosphericFluxProcessor;
import org.wildfire.fluxexplorer.service.FluxDataLoader;
import org.wildfire.fluxexplorer.service.WildfireRiskEstimator;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {

    private static final int CAMERA_PERMISSION_REQUEST_CODE = 42;
    private PermissionRequest pendingPermissionRequest;

    private WebView webView;
    private ProgressBar progressBar;
    private Spinner spinnerSite;
    private Spinner spinnerPhase;
    private TextView tvMetricsSummary;
    private TextView tvRiskSummary;

    private final FluxDataLoader dataLoader = new FluxDataLoader();
    private final AtmosphericFluxProcessor fluxProcessor = new AtmosphericFluxProcessor();
    private final WildfireRiskEstimator riskEstimator = new WildfireRiskEstimator();

    private Site currentSite;
    private String currentPhase = "pre";

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);
        spinnerSite = findViewById(R.id.spinnerSite);
        spinnerPhase = findViewById(R.id.spinnerPhase);
        tvMetricsSummary = findViewById(R.id.tvMetricsSummary);
        tvRiskSummary = findViewById(R.id.tvRiskSummary);

        loadFluxData();
        setupSpinners();
        setupWebView();

        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST_CODE);
        }
    }

    private void loadFluxData() {
        try {
            InputStream is = getAssets().open("web/data/sites.json");
            dataLoader.loadFromStream(is);
            if (!dataLoader.getSites().isEmpty()) {
                currentSite = dataLoader.getSites().get(0);
            }
        } catch (Exception e) {
            Toast.makeText(this, "Failed to load sites data: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void setupSpinners() {
        // Sites Spinner
        List<String> siteNames = new ArrayList<>();
        for (Site s : dataLoader.getSites()) {
            siteNames.add(s.getName());
        }
        ArrayAdapter<String> siteAdapter = new ArrayAdapter<>(this,
                android.R.layout.simple_spinner_dropdown_item, siteNames);
        spinnerSite.setAdapter(siteAdapter);
        spinnerSite.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (position >= 0 && position < dataLoader.getSites().size()) {
                    currentSite = dataLoader.getSites().get(position);
                    updateHudMetrics();
                    syncWebExplorerSite();
                }
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {}
        });

        // Phases Spinner
        List<String> phaseNames = new ArrayList<>();
        for (String p : dataLoader.getPhases()) {
            phaseNames.add(p.toUpperCase());
        }
        if (phaseNames.isEmpty()) {
            phaseNames.add("PRE");
            phaseNames.add("DURING");
            phaseNames.add("POST");
        }
        ArrayAdapter<String> phaseAdapter = new ArrayAdapter<>(this,
                android.R.layout.simple_spinner_dropdown_item, phaseNames);
        spinnerPhase.setAdapter(phaseAdapter);
        spinnerPhase.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (position >= 0 && position < dataLoader.getPhases().size()) {
                    currentPhase = dataLoader.getPhases().get(position);
                    updateHudMetrics();
                    syncWebExplorerPhase();
                }
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {}
        });
    }

    private void updateHudMetrics() {
        if (currentSite == null) return;

        FluxValue flux = currentSite.getPhaseValues(currentPhase);
        if (flux != null) {
            AtmosphericMetrics metrics = fluxProcessor.computeMetrics(flux);
            WildfireRiskReport risk = riskEstimator.estimateRisk(currentSite, currentPhase);

            tvMetricsSummary.setText(String.format(
                    "SH: %.0f W/m² | LH: %.0f W/m² | Bowen: %.2f | EvapFrac: %.2f | VPD: %.1f kPa",
                    flux.getSH(), flux.getLH(), metrics.getBowenRatio(), metrics.getEvaporativeFraction(), flux.getVPD()));

            tvRiskSummary.setText(String.format("Risk: %s (%.1f/100) — %s",
                    risk.getCategory().name(), risk.getRiskScore(), risk.getDescription()));
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                                request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                            } else {
                                pendingPermissionRequest = request;
                                requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST_CODE);
                            }
                            return;
                        }
                    }
                    request.grant(request.getResources());
                });
            }
        });

        webView.setWebViewClient(new WebViewClient());

        // Load offline local assets
        webView.loadUrl("file:///android_asset/web/index.html");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                if (pendingPermissionRequest != null) {
                    pendingPermissionRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    pendingPermissionRequest = null;
                }
            } else {
                if (pendingPermissionRequest != null) {
                    pendingPermissionRequest.deny();
                    pendingPermissionRequest = null;
                }
                Toast.makeText(this, "Camera permission is required for hand tracking", Toast.LENGTH_LONG).show();
            }
        }
    }

    private void syncWebExplorerSite() {
        if (currentSite != null && webView != null) {
            webView.evaluateJavascript("if (window.switchSite) { window.switchSite('" + currentSite.getId() + "'); }", null);
        }
    }

    private void syncWebExplorerPhase() {
        if (currentPhase != null && webView != null) {
            webView.evaluateJavascript("if (window.switchPhase) { window.switchPhase('" + currentPhase + "'); }", null);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
