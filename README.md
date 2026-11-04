# Wildfire Flux Explorer

Interactive hand-gesture controlled 3D visualization of wildfire impacts on atmosphere-biosphere fluxes.

Inspired by [takeapart.app](https://takeapart.app). Built for exploring pre-fire, during-fire, and post-fire phases of energy and environmental fluxes (SH, LH, ET, GPP, VPD, AOD) over Indian forest ecosystems (Similipal, Bandhavgarh, Chamba).

## Concept

- **MediaPipe Hands**: Webcam-based hand tracking (21 landmarks) for gestures.
- **Gestures**:
  - Open hand / swipe: Switch between Pre / During / Post fire phases.
  - Point: Select and inspect a flux variable.
  - Pinch: Zoom / pull out details.
  - Fist: Reset or form the model.
- **Visuals**: 3D terrain/forest, particle systems for fire, smoke (density ~ AOD), and flux particles.
- **Data**: Placeholder values from published results on the April 2021 Similipal wildfire (e.g., SH increase ~22-33%, LH decrease ~33%, VPD spike to ~5 kPa, AOD surge). Swap in real MODIS/ERA5/GEE data.

## Research Context

PhD work by M.S. Shyam Sunder (NIT Rourkela) on "Decoding Atmosphere-Biosphere flux Nexus in the Phase of Wildfire using AI techniques over Heterogeneous Forest Ecosystem".

Key papers:
- Impacts of wildfire over land and atmosphere in Similipal Biosphere Reserve, Odisha, India (Physics and Chemistry of the Earth, 2025).
- AGU presentations on wildfire-induced flux changes.

## How to Run

1. Clone the repo.
2. Open `index.html` in a modern browser (Chrome recommended).
3. Allow camera access for hand tracking (runs locally, video never leaves device).
4. Interact with gestures.

## Portfolio Use

- Demonstrates integration of CV (MediaPipe), WebGL/Three.js, and domain science for decision intelligence / xAI in EO.
- Useful for postdoc applications, LinkedIn posts, conference demos (AGU, TROPMET).
- Extend with real GEE exports, quantum-enhanced detection, or physics-informed layers.

## Next Steps

- Full particle engine and terrain from DEM.
- Site selector.
- Real data loaders.
- Performance optimization.

License: MIT (or as preferred). Private for now.
