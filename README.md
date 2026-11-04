# Wildfire Flux Explorer

Interactive hand-gesture controlled 3D visualization of wildfire impacts on atmosphere-biosphere fluxes.

Inspired by [takeapart.app](https://takeapart.app). Built for exploring pre-fire, during-fire, and post-fire phases of energy and environmental fluxes (SH, LH, ET, GPP, VPD, AOD) over Indian forest ecosystems (Similipal, Bandhavgarh, Chamba).

> ⚠️ The numbers in `data/sites.json` are **EXAMPLE placeholders** for UI development, not observations. Published Similipal findings are shown separately in the HUD, with citations.

## Concept

- **MediaPipe Hands** (Tasks Vision `HandLandmarker`): webcam hand tracking (21 landmarks), loaded only when you click *Enable hand tracking*.
- **Gestures**:
  | Gesture | Action |
  |---|---|
  | Open palm, move | Orbit the scene |
  | Open palm, fast horizontal swipe | Switch phase Pre / During / Post fire |
  | Pinch (thumb–index), open/close | Zoom in / out |
  | Point (index only), left↔right | Select flux variable |
  | Fist | Pause / resume particles |
- **Mouse/touch/keyboard fallback**: drag = orbit, wheel/pinch = zoom, ←/→ = phase, space = pause, 1–6 = variable; HUD buttons for everything.
- **Visuals**: procedural terrain + instanced forest per site; particle systems for fire (during phase, scaled by SH), smoke (density ∝ AOD), upward flux particles (LH/ET/SH) and downward carbon uptake (GPP).
- **HUD**: site selector, phase timeline, variable panel, bar chart across phases, published findings with sources.
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

ES modules need a local server (opening `index.html` via `file://` will not load them):

```bash
git clone https://github.com/murushyam/wildfire-flux-explorer && cd wildfire-flux-explorer
python -m http.server 8000   # open http://localhost:8000 in Chrome
```
Click *Enable hand tracking* and allow camera access. Hand tracking runs locally; video never leaves the device. No build step; Three.js and MediaPipe load from jsDelivr. GitHub Pages-ready (`.nojekyll`, root `index.html`).

## Data schema (dropping in real values)

`data/sites.json` (schema: `data/sites.schema.json`):
```json
{ "is_example": false,
  "variables": { "SH": {"label": "Sensible heat flux", "unit": "W m-2", "direction": "up"} },
  "phases": ["pre", "during", "post"],
  "sites": [{ "id": "similipal", "name": "...", "lat": 21.9, "lon": 86.3, "event": "...", "source": "MODIS/ERA5/CAMS, window ...",
              "relief": 0.8, "forest_density": 0.9,
              "values": { "pre": {"GPP": 0, "ET": 0, "LH": 0, "SH": 0, "VPD": 0, "AOD": 0}, "during": {}, "post": {} },
              "published_findings": [{"text": "...", "source": "doi"}] }] }
```
Suggested sources (site-mean over the burnt polygon, per phase window): GPP — MODIS MOD17A2H; ET — MOD16A2; SH/LH — ERA5-Land (`surface_sensible/latent_heat_flux`, convert J m⁻² → W m⁻²); VPD — from ERA5 2 m T and dewpoint; AOD — MODIS MCD19A2 (MAIAC) or CAMS. Set `is_example: false` to hide the EXAMPLE badge.

## Portfolio Use

- Demonstrates integration of computer vision (MediaPipe), WebGL/Three.js and domain science: a published wildfire–flux study turned into an interactive, explainable visual — useful for science communication and decision-support roles in EO.
- Useful for postdoc applications (link as an outreach/visualization demo next to the PCE 2025 paper), LinkedIn posts (short demo GIF + paper DOI), and conference demos (AGU, TROPMET).
- Only claim published numbers with citations; keep the EXAMPLE badge until real data are loaded.
- Extend with real GEE exports, physics-informed layers, or the climate-kernel-emulator what-if layer.

## Next Steps

- Real data loaders (GEE/ERA5 export script) and verified Bandhavgarh/Chamba events.
- Terrain from DEM (SRTM) and burned-area footprint.
- Demo GIF for README/LinkedIn.
- GitHub Pages deploy when the repo is made public.
- Performance tuning on low-end GPUs.

License: MIT (see LICENSE). Private for now.
