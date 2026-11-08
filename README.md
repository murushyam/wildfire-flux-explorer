# Wildfire Flux Explorer

[![Live Demo](https://img.shields.io/badge/Live_Demo-Run_Online-2ea44f?style=for-the-badge&logo=githubpages&logoColor=white)](https://murushyam.github.io/wildfire-flux-explorer/)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Android-informational?style=flat-square&logo=googlechrome&logoColor=white)](https://murushyam.github.io/wildfire-flux-explorer/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![DOI: 10.1016/j.pce.2025.104177](https://img.shields.io/badge/DOI-10.1016%2Fj.pce.2025.104177-brightgreen.svg?style=flat-square)](https://doi.org/10.1016/j.pce.2025.104177)

Interactive hand-gesture controlled 3D visualization of wildfire impacts on atmosphere-biosphere fluxes.

> 🚀 **Live Web App**: **[https://murushyam.github.io/wildfire-flux-explorer/](https://murushyam.github.io/wildfire-flux-explorer/)**  
> Instant access in any modern browser. Choose **📷 With Camera** (2-stage real-time hand & gesture detection via MediaPipe) or **🖱 Without Camera** (touch, mouse, keyboard, tactile control deck), plus **🎙 Voice Actions & Audio Briefing** (Web Speech Recognition & Text-to-Speech narration).

Inspired by [takeapart.app](https://takeapart.app). Built for exploring pre-fire, during-fire, and post-fire phases of energy and environmental fluxes (SH, LH, ET, GPP, VPD, AOD) and 7 vertical ecosystem strata over Indian forest ecosystems (Similipal, Bandhavgarh, Chamba).

> ⚠️ The numbers in `data/sites.json` are **EXAMPLE placeholders** for UI development, not observations. Published Similipal findings are shown separately in the HUD, with citations.

## Concept & Features

- **Dual Input Modes (`📷 With Camera` & `🖱 Without Camera`)**:
  - **Without Camera (Default)**: Full 3D orbit/zoom, tactile bottom dissection scrubber, strata solo tabs, keyboard shortcuts, and voice control — zero camera overhead.
  - **With Camera**: Activates a **2-Stage Hand & Gesture Detection Pipeline** powered by MediaPipe Tasks Vision (`HandLandmarker`):
    1. **Stage 1 — Hand Detection**: Validates hand anatomy & bounding box (`detectHand`), displays live confidence %, renders a 21-point colour-coded skeleton overlay (with toggleable finger lines and front/rear camera flip), and updates a live **5-Finger Extension Matrix (`T I M R P`)**.
    2. **Stage 2 — Gesture Classification**: Once a hand is locked, classifies and stabilizes multi-frame gestures (`GestureStabilizer`) with a visual stability progress bar before triggering 3D actions.
- **Hand Gestures**:
  | Gesture | Finger Pattern | Action |
  |---|---|---|
  | **Open Palm (Move / Hold)** | 5 fingers extended | Orbit 3D camera (hold still ~1 s to Explode / Assemble strata) |
  | **Horizontal Swipe** | Rapid palm sweep left / right | Cycle ecological monitoring site (Similipal → Bandhavgarh → Chamba) |
  | **Pinch / Spread** | Thumb + index distance | Scrub layer dissection (`TakeApart`) & zoom |
  | **Peace Sign (`✌`)** | Index + middle extended | Cycle fire phase (`Pre` → `During` → `Post`) |
  | **Three Fingers (`🤟`)** | Index + middle + ring | Cycle / solo vertical forest strata (Canopy, Understory, Litter, Duff, Soil, Flux) |
  | **Point (`☝`)** | Index finger only | Cycle atmospheric flux variable (`GPP`, `ET`, `LH`, `SH`, `VPD`, `AOD`) |
  | **Fist (`✊`)** | All fingers curled | Reset 3D camera & pause/resume particles |
  | **Thumbs Up (`👍`)** | Thumb up, fingers curled | Toggle Zen / Clean full-screen view |
  | **Rock / Horns (`🤘`)** | Index + pinky extended | Cycle Wind & Flame Boost (`1x` → `2x` → `3x` → `0.5x`) |
  | **Call-Me / Shaka (`🤙`)** | Thumb + pinky extended | Speak scientific audio briefing aloud (TTS narration) |
- **Voice Actions & Audio Briefing (`🎙 Voice`)**:
  - **Speech Recognition**: Hands-free voice commands (including compound utterances like *"during fire and explode canopy"*) for switching camera modes, exploding/assembling strata, soloing layers, selecting phases/variables/sites, boosting wind, starting the auto-tour, or narrating data.
  - **Interactive Fallback**: Text command input box + 14 one-tap quick action chips in the Voice Drawer (`V`) so every voice action works even without a microphone.
  - **Scientific Audio Narration (`🔊 Narrate`)**: Reads site telemetry, active phase/flux values, and published Similipal research findings aloud using Web Speech Synthesis (`speechSynthesis`).
- **Interactive Boost & Exploration Tools**:
  - **🌬 Wind & Flame Boost (`W`)**: Cycles wind turbulence, tree sway, and flame/ember intensity (`1x`, `2x`, `3x`, `0.5x`).
  - **🎬 Guided Auto-Tour (`T`)**: Automated scientific choreography that steps through Pre-Fire, During-Fire, Post-Fire, strata dissection, and solo layer callouts.
  - **📸 3D Snapshot (`P`)**: Captures and downloads a timestamped PNG of the current 3D forest dissection view.
  - **⚡ Light / Full Graphics Tiers**: Starts in **Light** mode by default for smooth mobile/laptop performance; toggle to **Full** for maximum foliage density and high-DPI rendering.
- **Keyboard, Mouse & Touch Controls**:
  | Action | Mouse / Touch / Keyboard |
  |---|---|
  | Orbit / Zoom | Drag / wheel / pinch, `+` / `-` |
  | Input Mode | `C` (*With Camera* / *Without Camera* buttons) |
  | Voice Drawer / Narrate | `V` (*Voice* drawer), `N` (*Narrate* TTS briefing) |
  | Phase | `←` / `→`, timeline buttons |
  | Variable | `1`–`6`, variable buttons |
  | Explode / Dissect Layers | `E`, *TakeApart* button, or slider (`0`–`100%`) |
  | Solo Stratum | Strata tabs (*All*, *Canopy*, *Understory*, *Litter*, *Duff*, *Soil*, *Flux*) |
  | Next Site | `S`, site selector |
  | Wind & Flame Boost | `W`, *Wind* button |
  | Guided Auto-Tour | `T`, *Auto-Tour* button |
  | 3D PNG Snapshot | `P`, *Snapshot* button |
  | Zen View / Gesture Guide | `Z` (*Zen* button), `G` (*Guide* modal) |
  | Pause Particles | `Space` |
- **Visuals**: Procedural terrain + 7-stratum take-apart forest architecture (Atmospheric Boundary Layer, Overstory Crown, Understory & Trunks, Surface Litter, Organic Duff, Mineral Soil & Roots); custom GLSL volumetric flames, curling smoke plumes, wind streaks, and 3D flux ribbons.
- **HUD & Panels**: All panels (Header Pill, Science & Chart HUD, Voice Drawer, Control Deck, Camera Detector, Stratum Callout) support minimize/collapse and full-screen Zen Mode.
- See [docs/CONCEPT.md](docs/CONCEPT.md).

## Variables and units

| Key | Variable | Unit |
|---|---|---|
| GPP | Gross primary productivity | gC m⁻² d⁻¹ |
| ET | Evapotranspiration | mm d⁻¹ |
| LH | Latent heat flux | W m⁻² |
| SH | Sensible heat flux | W m⁻² |
| VPD | Vapour pressure deficit | kPa |
| AOD | Aerosol optical depth (550 nm) | unitless |

## Research Context

PhD work by M.S. Shyam Sunder (NIT Rourkela) on "Decoding Atmosphere-Biosphere flux Nexus in the Phase of Wildfire using AI techniques over Heterogeneous Forest Ecosystem".

Key papers:
- Impacts of wildfire over land and atmosphere in Similipal Biosphere Reserve, Odisha, India. *Physics and Chemistry of the Earth* 141 (2025) 104177. doi:[10.1016/j.pce.2025.104177](https://doi.org/10.1016/j.pce.2025.104177) — fire event 25–29 April 2021, fire vs non-fire: SH +~32.7 W m⁻² (peak ~145 W m⁻²), LH −~33 %, net solar radiation +~58 %, LST +~5 °C, VPD peak ~5.1 kPa, ET −53.3 % (pre→post), AOD >3×.
- Assessment of Wildfire-Induced Changes in Energy Fluxes and Environmental Variables: Similipal (EGU24-106, doi:[10.5194/egusphere-egu24-106](https://doi.org/10.5194/egusphere-egu24-106)) — GPP and ET decline during fire and recover post-fire.
- Forest Fire Induced Air Pollution over Eastern India during March 2021, *Aerosol and Air Quality Research* (2022) — AOD +56.21 %, PM2.5 +~12 µg m⁻³, burnt area ~674 km².
- AGU presentations on wildfire-induced flux changes.

## How to Run

### 1. Online (Instant Demo)
No installation or build required. Run directly in your web browser:
👉 **[https://murushyam.github.io/wildfire-flux-explorer/](https://murushyam.github.io/wildfire-flux-explorer/)**

Click **📷 With Camera** (or *📷 Start Camera Detection*) and allow camera access to enable 2-stage hand and gesture tracking, or stay in **🖱 Without Camera** mode to use mouse, touch, keyboard, or **🎙 Voice** actions. Hand tracking runs 100% locally on your device via MediaPipe; video frames never leave your machine.

### 2. Local Web Server
ES modules need a local server (opening `index.html` via `file://` will not load them):

```bash
git clone https://github.com/murushyam/wildfire-flux-explorer && cd wildfire-flux-explorer
python -m http.server 8000   # open http://localhost:8000 in Chrome
```

No build step required; Three.js and MediaPipe load from jsDelivr CDN. GitHub Pages-ready (`.nojekyll`, root `index.html`).

### 3. Android Application (APK)
An installable Android APK can be built locally using the automated build script:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_apk.ps1
```

The compiled and signed debug APK is output to:
`app/build/outputs/apk/debug/app-debug.apk`

## Data schema (dropping in real values)

`data/sites.json` (schema: `data/sites.schema.json`):
```json
{ "is_example": false,
  "variables": { "SH": {"label": "Sensible heat flux", "unit": "W m-2", "direction": "up", "color": "#ffd23f"} },
  "phases": ["pre", "during", "post"],
  "sites": [{ "id": "similipal", "name": "...", "lat": 21.9, "lon": 86.3, "event": "...", "source": "MODIS/ERA5/CAMS, window ...",
              "relief": 0.8, "forest_density": 0.9, "burn_zone": {"x": 1.5, "z": -1, "r": 5},
              "values": { "pre": {"GPP": 0, "ET": 0, "LH": 0, "SH": 0, "VPD": 0, "AOD": 0}, "during": {}, "post": {} },
              "published_findings": [{"text": "...", "source": "doi"}] }] }
```
Suggested sources (site-mean over the burnt polygon, per phase window): GPP — MODIS MOD17A2H; ET — MOD16A2; SH/LH — ERA5-Land (`surface_sensible/latent_heat_flux`, convert J m⁻² → W m⁻²); VPD — from ERA5 2 m T and dewpoint; AOD — MODIS MCD19A2 (MAIAC) or CAMS. Set `is_example: false` to hide the EXAMPLE badge and warning. `burn_zone` (scene units, terrain spans −10..10) is a visual EXAMPLE footprint, not a mapped burnt area; `color` is optional.

## Portfolio Use

- Demonstrates integration of computer vision (MediaPipe), WebGL/Three.js and domain science: a published wildfire–flux study turned into an interactive, explainable visual — useful for science communication and decision-support roles in EO.
- Useful for postdoc applications (link as an outreach/visualization demo next to the PCE 2025 paper), LinkedIn posts (short demo GIF + paper DOI), and conference demos (AGU, TROPMET).
- Only claim published numbers with citations; keep the EXAMPLE badge until real data are loaded.
- Extend with real GEE exports, physics-informed layers, or the climate-kernel-emulator what-if layer.

## Next Steps

- Real data loaders (GEE/ERA5 export script) and verified Bandhavgarh/Chamba events.
- Terrain from DEM (SRTM) and burned-area footprint.
- Demo GIF for README/LinkedIn.
- [x] GitHub Pages deployed at https://murushyam.github.io/wildfire-flux-explorer/
- [x] Android installable APK build pipeline verified
- Performance tuning on low-end GPUs.

License: MIT (see LICENSE). Private for now.
