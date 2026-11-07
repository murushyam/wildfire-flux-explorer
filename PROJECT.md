# Project: wildfire-flux-explorer

## Architecture
- **Application Type**: Android mobile application & studio-grade WebGL PBR application for wildfire and atmospheric flux data exploration with TakeApart 3D stratigraphy dissection.
- **Languages & Frameworks**: Java 17 / Android Native WebView / Three.js r160 / MediaPipe Tasks Vision / Procedural WebGL GLSL.
- **Build System**: Standalone Android SDK Toolchain Build Pipeline (`build_apk.ps1`) executing `aapt2`, `javac`, `d8`, `zipalign`, and `apksigner`.
- **Java Toolchain**: Microsoft OpenJDK 17 LTS (`C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot\`).
- **Android SDK Toolchain**: Local Android SDK verified at `I:\tele\AutoraSolution-source\android-sdk` (`build-tools 35.0.0`, platforms `android-34`, `android-36`, pre-accepted licenses).
- **Deliverable**: Installable, 4-byte aligned, cryptographically signed Android APK (`app/build/outputs/apk/debug/app-debug.apk`).
- **Version Control**: Git repository tracking `https://github.com/murushyam/wildfire-flux-explorer.git`.

## Feature Inventory
| # | Feature | Description | Milestone | Status | Source |
|---|---------|-------------|-----------|--------|--------|
| 1 | Git Repository Cloning & Remote Tracking | Clone remote private repository into `i:\tele\wildfire_explorer` and preserve origin remote tracking | M1 | COMPLETE | User Request |
| 2 | Environment Configuration | Android SDK & Java Toolchain Integration via `local.properties` pointing to `I:\tele\AutoraSolution-source\android-sdk` | M1 | COMPLETE | User Request |
| 3 | Flux Data Ingestion & Atmospheric Metric Processing | Ingest, parse, and process wildfire flux datasets (sensible/latent heat flux, carbon flux, vapor pressure deficit) | M1 | COMPLETE | User Request |
| 4 | Spatiotemporal Wildfire Hotspot Exploration | Interactive map / list view of wildfire incidents and thermal anomalies with date/time range filtering | M1 | COMPLETE | User Request |
| 5 | Predictive Flux Modeling & Risk Estimation | Wildfire risk estimation and atmospheric condition flux projection charts | M1 | COMPLETE | User Request |
| 6 | Android Build Automation & Toolchain (`build_apk.ps1`) | Compile resources (`aapt2`), Java sources (`javac`), dex bytecode (`d8`), align and sign APK | M1 | COMPLETE | User Request |
| 7 | Installable APK Compilation & Alignment | Packaging forward-slash asset entries and 4-byte archive alignment (`zipalign`) | M1 | COMPLETE | User Request |
| 8 | APK Cryptographic Signing | Sign APK with debug keystore (`debug.keystore`) using APK Signature Scheme v2 & v3 | M1 | COMPLETE | User Request |
| 9 | Automated Unit Testing Suite Execution | Execute 11 automated JUnit tests covering domain models, data parsing, and risk assessment | M1 | COMPLETE | User Request |
| 10 | Photorealistic 3D PBR Forest Overhaul | Realistic procedural trunks, SSS foliage, understory ladder fuels, charred litter beds, TakeApart dissection | M1 | COMPLETE | User Follow-up |
| 11 | Volumetric GPU Raymarched Fire & Embers | Planckian blackbody emission, 3D fBm turbulence, buoyant embers, aerodynamic smoke plumes | M1 | COMPLETE | User Follow-up |
| 12 | Visual Gesture Guidance HUD | Floating `#gestureStatusPill` with dynamic icon/name/action chip and `#gestureGuideModal` cards | M2 | COMPLETE | User Follow-up |
| 13 | Multi-Gesture Recognition Suite | Classifier recognizing pinch (continuous ratio), open palm (orbit), fist (reset), peace (phase), 3-finger (strata), point (vars), thumbs-up (Zen) | M2 | COMPLETE | User Follow-up |
| 14 | Visible 21-Point Finger Skeleton Lines | Glowing cyan skeletal bones and joint dots overlay (`#skeletonCanvas`) with on/off toggle and persistence | M2 | COMPLETE | User Follow-up |
| 15 | Minimizable Popups & Global Zen View | Minimize chevrons (`.minimize-btn`) on all cards plus single-tap Zen View (`#zenBtn`, 'Z' key, `#exitZenBtn`) | M2 | COMPLETE | User Follow-up |
| 16 | Graphics Performance Tier Mode (Default "Light") | Default "Light" tier (1.0 DPR, 16 raymarch steps, throttled tracking) vs "Full" tier (1.75 DPR, 36 steps) | M2 | COMPLETE | User Follow-up |
| 17 | Android WebView Camera Permissions | `<uses-feature>` flags in manifest and `WebChromeClient.onPermissionRequest` in `MainActivity.java` | M2 | COMPLETE | User Follow-up |
| 18 | Web Asset Mirroring & Verified APK Rebuild | Synchronize all web files to `app/src/main/assets/web/`, build & sign `app-debug.apk` | M2 | COMPLETE | User Follow-up |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Android App, 3D Graphics & Initial APK | Clone, build toolchain, photorealistic PBR graphics, volumetric fire, TakeApart dissection, APK build & initial test verification | None | COMPLETE |
| M2 | Gestures, Skeleton, Zen View, Light Tier & Permissions | Visual gesture guide modal, real-time status pill, 21-point skeleton overlay with toggle, minimizable panels, Zen view, default Light performance tier, Android camera permissions, asset sync, signed APK, and comprehensive test suites | M1 | COMPLETE |

## Verification Summary
- **Node.js Test Suites**:
  - `tests/test-gestures-and-perf.mjs`: 15/15 passed (100%)
  - `tests/test-challenger-m1-2.mjs`: 19/19 passed (100%)
  - `tests/test-m1-adversarial.mjs`: 114/114 passed (100%)
  - `tests/test-m1-remediation-verification.mjs`: 18/18 passed (100%)
- **Java Unit Test Suite**:
  - `org.wildfire.fluxexplorer.TestRunner`: 11/11 passed (100%)
- **Android APK Build**:
  - `app/build/outputs/apk/debug/app-debug.apk`: 91,471 bytes, 4-byte aligned, signed with APK Signature Scheme v2 & v3.
- **Git State**:
  - Working tree prepared for commit and push to `origin/main`.
