# Project: wildfire-flux-explorer

## Architecture
- **Application Type**: Android mobile application for wildfire and atmospheric flux data exploration.
- **Languages & Frameworks**: Kotlin / Java / Android Native (or hybrid framework wrapper) building via Gradle wrapper (`gradlew.bat`).
- **Build System**: Gradle 8.x with Android Gradle Plugin (AGP) 8.x.
- **Java Toolchain**: Microsoft OpenJDK 17 LTS (`C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot\`).
- **Android SDK Toolchain**: Local Android SDK verified at `I:\tele\AutoraSolution-source\android-sdk` (`build-tools 35.0.0`, platforms `android-34`, `android-36`, pre-accepted licenses).
- **Deliverable**: Installable Android APK (`.apk` binary) output in `build/outputs/apk/debug/`.
- **Version Control**: Git repository tracking `https://github.com/murushyam/wildfire-flux-explorer.git`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Git Repository Cloning & Remote Tracking | Clone remote private repository into `i:\tele\wildfire_explorer` and preserve origin remote tracking | M1 | Survey (R1) |
| 2 | Environment Configuration | Android SDK & Java Toolchain Integration via `local.properties` pointing to `I:\tele\AutoraSolution-source\android-sdk` | M1 | Survey (R1) |
| 3 | Flux Data Ingestion & Atmospheric Metric Processing | Ingest, parse, and process wildfire flux datasets (sensible/latent heat flux, carbon flux, vapor pressure deficit) | M2 | Survey (R1, Domain Specs) |
| 4 | Spatiotemporal Wildfire Hotspot Exploration | Interactive map / list view of wildfire incidents and thermal anomalies with date/time range filtering | M2 | Survey (R1, Domain Specs) |
| 5 | Predictive Flux Modeling & Risk Estimation | Wildfire risk estimation and atmospheric condition flux projection charts | M2 | Survey (R1, Domain Specs) |
| 6 | Gradle Build Automation & Dependency Resolution | Resolve project dependencies, Gradle plugins (AGP), and compile Kotlin/Java sources | M2 | Survey (R1, R2) |
| 7 | Installable APK Compilation (`assembleDebug`) | Compile, package, and align application into a valid installable Android APK | M2 | Survey (R2) |
| 8 | APK Signing & Alignment | Sign APK with debug keystore (`debug.keystore`) and verify zip integrity | M2 | Survey (R2) |
| 9 | Automated Unit Testing Suite Execution | Execute all automated unit tests covering domain models, data parsing, and UI helpers | M3 | Survey (R3) |
| 10 | Linting & Static Code Quality Analysis | Verify zero fatal lint errors and clean compilation diagnostics | M3 | Survey (R3) |
| 11 | Local Git Commit & Clean Working Tree | Stage all fixes and build configurations, and commit locally with a descriptive commit message | M4 | Survey (R4) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Repository Setup & Toolchain Configuration | Clone `https://github.com/murushyam/wildfire-flux-explorer` into `i:\tele\wildfire_explorer`, configure `local.properties` with local Android SDK (`I:\tele\AutoraSolution-source\android-sdk`) and verify toolchains | None | IN_PROGRESS (Blocked on User GitHub Auth/Clone) |
| M2 | Android Application Build & APK Generation | Resolve dependencies, compile code, execute `.\gradlew.bat assembleDebug` to produce installable Android APK | M1 | PLANNED |
| M3 | Automated Verification & Testing | Execute project test suites (`.\gradlew.bat test`), verify APK file validity, run static checks | M2 | PLANNED |
| M4 | Local Git Commit | Stage all configuration changes and commit locally with an informative, descriptive commit message | M3 | PLANNED |

## Interface Contracts
### Git Remote ↔ Local Repository (M1)
- Remote URL: `https://github.com/murushyam/wildfire-flux-explorer.git`
- Authentication: GitHub account `murushyam`
- Local Path: `i:\tele\wildfire_explorer`
- Verification: `git -C "i:\tele\wildfire_explorer" remote -v` contains origin fetch/push

### Android Build Toolchain ↔ Gradle Project (M1 ↔ M2)
- SDK Directory: `local.properties` specifies `sdk.dir=I\:\\tele\\AutoraSolution-source\\android-sdk`
- JDK: `JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot\`
- Build Command: `.\gradlew.bat assembleDebug` (executed with unsandboxed permission or in terminal to support Gradle daemon interprocess socket)
- Output Artifact: `app/build/outputs/apk/debug/app-debug.apk` (or submodule equivalent)

### Test Runner ↔ Test Reports (M2 ↔ M3)
- Execution Command: `.\gradlew.bat test`
- Pass Criteria: 100% tests pass, 0 failures, 0 errors, exit code 0
- Artifact Output: `build/reports/tests/testDebugUnitTest/index.html`

### Working Tree ↔ Local Git History (M3 ↔ M4)
- Command: `git add . && git commit -m "<message>"`
- Cleanness: `git status` reports clean working tree (no uncommitted modified files, untracked build artifacts properly ignored)

## Code Layout
- `.agents/teamwork/`: Orchestrator and agent coordination metadata.
- `local.properties`: Android SDK configuration pointing to local SDK.
- Standard Android Project Structure (upon cloning):
  - `app/` (or `<module>/`): Source code (`src/main/java/`, `src/main/kotlin/`, `src/main/res/`, `AndroidManifest.xml`).
  - `app/build.gradle`: Android application build configuration.
  - `build.gradle` / `settings.gradle`: Project-level build script and repository configurations.
  - `gradlew`, `gradlew.bat`, `gradle/wrapper/`: Gradle wrapper.
