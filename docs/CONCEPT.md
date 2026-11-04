# Concept

A gesture-driven 3D "take-apart" view of a forest during a wildfire: the user pulls apart the land–atmosphere coupling layer by layer.

| Layer | Visual | Driven by |
|---|---|---|
| Terrain + forest | procedural heightfield, instanced trees (seeded per site) | `relief`, `forest_density` |
| Fire | orange embers, only in *during* phase | SH (normalized) |
| Smoke | grey drifting particles | AOD (density) |
| Upward fluxes | blue particles rising | LH (or SH when SH selected); represents LH/ET/SH |
| Carbon uptake | green particles sinking into canopy | GPP |

Phases pre → during → post are switched by a swipe; the HUD bar chart shows the selected variable across phases.
Scientific framing follows the Similipal 2021 analyses (fire vs non-fire locations, before/during/after): higher SH, LST, VPD and AOD during fire, lower LH and ET; GPP declines during fire and recovers after (EGU24-106).

Future layers: real DEM terrain (SRTM), MODIS burned area footprint, HYSPLIT smoke trajectory ribbons, Bandhavgarh/Chamba comparisons, what-if slider linked to the climate emulator.
