// ============================================================================
// voice-controller.js
// Natural-Language Voice Command Parser, Compound Utterance Engine,
// Web Speech Recognition & Scientific Audio Narration (Text-to-Speech).
// ============================================================================

/**
 * Catalog of supported voice command examples grouped by category for the UI Guide.
 */
export const VOICE_COMMAND_GUIDE = [
  {
    category: 'Camera & Hand Tracking',
    icon: '📷',
    commands: [
      { phrase: '"With camera" / "Turn on camera"', action: 'Enable camera & 2-stage hand/gesture tracking' },
      { phrase: '"Without camera" / "Turn off camera"', action: 'Switch to touch/mouse/voice mode & stop camera' },
      { phrase: '"Skeleton on" / "Turn off skeleton"', action: 'Toggle 21-point finger detection lines' }
    ]
  },
  {
    category: '3D Dissection & Strata',
    icon: '🎛',
    commands: [
      { phrase: '"Explode" / "Take apart"', action: 'Full 3D vertical layer dissection (100%)' },
      { phrase: '"Assemble" / "Collapse"', action: 'Reassemble all forest strata (0%)' },
      { phrase: '"Canopy" / "Understory" / "Litter"', action: 'Solo specific above-ground forest stratum' },
      { phrase: '"Duff" / "Soil" / "Flux" / "All layers"', action: 'Solo subsurface horizons, flux, or restore all' }
    ]
  },
  {
    category: 'Fire Phases & Sites',
    icon: '🔥',
    commands: [
      { phrase: '"Pre fire" / "During fire" / "Post fire"', action: 'Switch wildfire disturbance phase' },
      { phrase: '"Similipal" / "Bandhavgarh" / "Chamba"', action: 'Switch ecological monitoring site' },
      { phrase: '"Sensible heat" / "Latent heat" / "GPP"', action: 'Focus atmospheric energy or carbon flux variable' },
      { phrase: '"ET" / "VPD" / "AOD"', action: 'Focus evapotranspiration, vapor deficit, or aerosols' }
    ]
  },
  {
    category: 'Boost, Tour & Narration',
    icon: '🎙',
    commands: [
      { phrase: '"Wind boost" / "Calm wind"', action: 'Boost or normalize wind speed & flame tilt' },
      { phrase: '"Start tour" / "Stop auto tour"', action: 'Automated 3D scientific dissection & phase tour' },
      { phrase: '"Narrate" / "Stop speaking"', action: 'Speak research paper findings aloud (TTS)' },
      { phrase: '"Light mode" / "Full mode" / "Zen mode"', action: 'Switch graphics performance tier or clean view' }
    ]
  }
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extracts all actionable command intents from a single or compound spoken transcript.
 * Uses non-overlapping phrase consumption so words inside an already-matched command
 * (e.g., "flux" in "sensible heat flux", or "play" in "play tour", or "camera" in "reset camera")
 * never falsely trigger a secondary intent, while genuine multi-intent sentences
 * (e.g., "without camera explode during fire") extract every command in order.
 *
 * @param {string} rawTranscript
 * @returns {Array<{ matched: boolean, intent: string, param?: any, icon: string, label: string, description: string, transcript: string }>}
 */
export function parseVoiceCommands(rawTranscript) {
  if (!rawTranscript || typeof rawTranscript !== 'string') return [];

  let rem = rawTranscript
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!rem) return [];

  const matchedActions = [];

  // Consumes the first matching phrase (bounded by word boundaries) from `rem`
  const consumePhrases = (...phrases) => {
    // Sort longest first so multi-word phrases consume completely
    const sorted = [...phrases].sort((a, b) => b.length - a.length);
    for (const p of sorted) {
      const rx = new RegExp(`(?:^|\\b)${escapeRegex(p)}(?:\\b|$)`, 'i');
      if (rx.test(rem)) {
        rem = rem.replace(rx, ' ').replace(/\s+/g, ' ').trim();
        return true;
      }
    }
    return false;
  };

  // Consumes a regex pattern from `rem` if matched
  const consumeRegex = (rx) => {
    if (rx.test(rem)) {
      rem = rem.replace(rx, ' ').replace(/\s+/g, ' ').trim();
      return true;
    }
    return false;
  };

  const pushAction = (intent, param, icon, label, description) => {
    matchedActions.push({
      matched: true,
      intent,
      ...(param !== undefined ? { param } : {}),
      icon,
      label,
      description,
      transcript: rawTranscript
    });
  };

  // -------------------------------------------------------------------------
  // 1. Camera Reset vs Camera Flip vs Without Camera vs With Camera
  // -------------------------------------------------------------------------
  if (consumePhrases('reset 3d camera', 'reset camera view', 'reset camera', 'reset view', 'home view', 'center camera')) {
    pushAction('resetCamera', undefined, '🎥', 'Camera Reset', 'Returned 3D camera to home perspective');
  }

  if (consumePhrases('flip camera', 'switch camera', 'front camera', 'rear camera', 'back camera')) {
    pushAction('flipCamera', undefined, '🔄', 'Flip Camera', 'Toggling Front / Rear camera lens');
  }

  if (
    consumePhrases(
      'without camera mode', 'without camera', 'no camera', 'camera off',
      'turn off the camera', 'turn off camera', 'switch off the camera', 'switch off camera',
      'stop the camera', 'stop camera', 'close the camera', 'close camera',
      'disable the camera', 'disable camera', 'disable hand tracking', 'disable hand',
      'stop hand tracking', 'stop tracking', 'touch mode', 'mouse mode', 'without cam', 'no cam'
    ) ||
    consumeRegex(/\b(?:off|stop|close|disable|without|no|hide)\s+(?:the\s+)?(?:camera|webcam|hand\s+tracking)\b/i) ||
    consumeRegex(/\b(?:camera|webcam|hand\s+tracking)\s+(?:off|stop|close|disable)\b/i)
  ) {
    pushAction('setCameraMode', 'without-camera', '🖱', 'Without Camera', 'Switched to Without-Camera mode (Touch, Mouse & Voice)');
  } else if (
    consumePhrases(
      'turn on with camera mode', 'with camera mode', 'with camera', 'camera on',
      'turn on the camera', 'turn on camera', 'switch on the camera', 'switch on camera',
      'start the camera', 'start camera', 'open the camera', 'open camera',
      'enable the camera', 'enable camera', 'use the camera', 'use camera', 'camera mode',
      'enable hand tracking', 'enable hand', 'detect my hand', 'detect hand',
      'hand tracking', 'start tracking', 'with cam'
    ) ||
    consumeRegex(/\b(?:on|start|open|enable|with|use)\s+(?:the\s+)?(?:camera|webcam|hand\s+tracking)\b/i)
  ) {
    pushAction('setCameraMode', 'with-camera', '📷', 'With Camera', 'Enabled Camera for 2-stage Hand & Gesture detection');
  }

  // -------------------------------------------------------------------------
  // 2. Finger Skeleton Lines (check OFF / HIDE before ON / SHOW)
  // -------------------------------------------------------------------------
  if (
    consumePhrases(
      'turn off finger lines', 'turn off the skeleton', 'turn off skeleton', 'turn off lines',
      'switch off skeleton', 'disable finger lines', 'disable skeleton', 'disable lines',
      'without skeleton', 'no skeleton', 'stop skeleton',
      'skeleton off', 'hide skeleton', 'hide finger lines', 'hide lines', 'finger lines off', 'lines off'
    ) ||
    consumeRegex(/\b(?:off|hide|disable|no|without|remove)\s+(?:the\s+)?(?:skeleton|finger\s+lines|detection\s+lines)\b/i) ||
    consumeRegex(/\b(?:skeleton|finger\s+lines|detection\s+lines)\s+(?:off|hide|disable)\b/i)
  ) {
    pushAction('setSkeleton', false, '🦴', 'Skeleton OFF', 'Hidden 21-point finger detection skeleton lines');
  } else if (
    consumePhrases(
      'turn on finger lines', 'turn on the skeleton', 'turn on skeleton', 'turn on lines',
      'enable skeleton', 'skeleton on', 'show skeleton', 'show finger lines', 'show lines',
      'finger lines on', 'lines on', 'skeleton'
    )
  ) {
    pushAction('setSkeleton', true, '🦴', 'Skeleton ON', 'Showing 21-point finger detection skeleton lines');
  }

  // -------------------------------------------------------------------------
  // 3. Dissection / TakeApart Scrubber
  // -------------------------------------------------------------------------
  if (consumePhrases('half explode', 'explode 50', 'explode fifty', 'half dissect', '50 percent', 'fifty percent')) {
    pushAction('setExplode', 0.5, '🎛', '50% Dissected', 'Set TakeApart layer dissection to 50%');
  } else if (consumePhrases('take apart', 'takeapart', 'explode all', 'explode layers', 'open layers', 'separate layers', 'explode', 'dissect')) {
    pushAction('setExplode', 1.0, '💥', 'TakeApart (100%)', 'Exploded all 7 forest & soil strata layers');
  } else if (consumePhrases('put together', 'close layers', 'combine layers', 'reassemble', 'assemble', 'collapse')) {
    pushAction('setExplode', 0.0, '🌲', 'Assembled (0%)', 'Assembled all forest & soil strata into intact block');
  }

  // -------------------------------------------------------------------------
  // 4. Fire Phases (Pre, During, Post, Cycle)
  // -------------------------------------------------------------------------
  if (consumePhrases('pre-fire', 'pre fire', 'prefire', 'before fire', 'phase 1', 'phase one', 'unburned')) {
    pushAction('setPhase', 0, '🌿', 'Pre-Fire Phase', 'Switched to Pre-fire baseline ecological state');
  } else if (consumePhrases('during fire', 'active fire', 'start fire', 'phase 2', 'phase two', 'burning', 'ignite', 'burn')) {
    pushAction('setPhase', 1, '🔥', 'During Fire Phase', 'Activated wildfire combustion & convective plume state');
  } else if (consumePhrases('post-fire', 'post fire', 'postfire', 'after fire', 'phase 3', 'phase three', 'recovery', 'aftermath', 'charred')) {
    pushAction('setPhase', 2, '🌱', 'Post-Fire Phase', 'Switched to Post-fire charred & recovery state');
  } else if (consumePhrases('next phase', 'cycle phase', 'change phase', 'switch phase')) {
    pushAction('cyclePhase', undefined, '⏭', 'Next Fire Phase', 'Cycled to next wildfire timeline phase');
  }

  // -------------------------------------------------------------------------
  // 5. Flux Variables (SH, LH, GPP, ET, VPD, AOD)
  // Evaluated BEFORE generic "flux" stratum so "sensible heat flux" or "latent heat flux"
  // selects the variable rather than soloing Stratum 0!
  // -------------------------------------------------------------------------
  if (consumePhrases('sensible heat flux', 'sensible heat', 'sh')) {
    pushAction('setVar', 'SH', '🌡', 'Variable: SH', 'Focused Sensible Heat Flux (W m⁻²)');
  } else if (consumePhrases('latent heat flux', 'latent heat', 'lh')) {
    pushAction('setVar', 'LH', '💧', 'Variable: LH', 'Focused Latent Heat Flux (W m⁻²)');
  } else if (consumePhrases('gross primary productivity', 'gross primary', 'primary productivity', 'carbon flux', 'carbon sink', 'carbon uptake', 'productivity', 'carbon', 'gpp')) {
    pushAction('setVar', 'GPP', '🍃', 'Variable: GPP', 'Focused Gross Primary Productivity (gC m⁻² d⁻¹)');
  } else if (consumePhrases('evapotranspiration flux', 'evapotranspiration', 'transpiration', 'et')) {
    pushAction('setVar', 'ET', '💨', 'Variable: ET', 'Focused Evapotranspiration (mm d⁻¹)');
  } else if (consumePhrases('vapour pressure deficit', 'vapor pressure deficit', 'vapour pressure', 'vapor pressure', 'pressure deficit', 'vpd')) {
    pushAction('setVar', 'VPD', '☀️', 'Variable: VPD', 'Focused Vapour Pressure Deficit (kPa)');
  } else if (consumePhrases('aerosol optical depth', 'optical depth', 'smoke density', 'aerosols', 'aerosol', 'aod')) {
    pushAction('setVar', 'AOD', '🌫', 'Variable: AOD', 'Focused Aerosol Optical Depth (550 nm)');
  }

  // -------------------------------------------------------------------------
  // 6. Wind & Flame Boost (evaluated before "canopy" so "canopy wind boost" boosts wind)
  // -------------------------------------------------------------------------
  if (consumePhrases('calm wind', 'normal wind', 'reset wind', 'low wind')) {
    pushAction('setWindBoost', 1.0, '🍃', 'Normal Wind (1x)', 'Restored baseline canopy wind & flame shear');
  } else if (consumePhrases('canopy wind boost', 'wind boost', 'boost wind', 'strong wind', 'high wind', 'more wind', 'firestorm', 'gale', 'wind')) {
    pushAction('setWindBoost', 'cycle', '🌬', 'Wind Boost', 'Boosted atmospheric wind shear & flame turbulence');
  }

  // -------------------------------------------------------------------------
  // 7. Strata Layer Soloing
  // -------------------------------------------------------------------------
  if (consumePhrases('show all layers', 'all layers', 'show all', 'all strata', 'full forest', 'exit solo', 'clear solo')) {
    pushAction('setSoloStratum', -1, '🌲', 'All Strata Layers', 'Showing all 7 atmosphere-biosphere-pedosphere strata');
  } else if (consumePhrases('solo canopy', 'show canopy', 'overstory canopy', 'canopy layer', 'canopy', 'overstory', 'crowns', 'trees')) {
    pushAction('setSoloStratum', 2, '🌳', 'Solo: Overstory Canopy', 'Isolated L2 Overstory Sal Canopy (Shorea robusta)');
  } else if (consumePhrases('solo understory', 'show understory', 'ladder fuels', 'ladder fuel', 'understory layer', 'understory', 'shrubs', 'bamboo')) {
    pushAction('setSoloStratum', 3, '🌿', 'Solo: Understory', 'Isolated L3 Understory & Bamboo Ladder Fuels');
  } else if (consumePhrases('solo litter', 'show litter', 'surface litter', 'leaf litter', 'forest floor', 'litter layer', 'litter', 'leaves', 'twigs')) {
    pushAction('setSoloStratum', 4, '🍂', 'Solo: Surface Litter', 'Isolated L4 Surface Litter Bed & Flaming Front');
  } else if (consumePhrases('solo duff', 'show duff', 'duff layer', 'duff', 'peat', 'humus', 'fermentation')) {
    pushAction('setSoloStratum', 5, '🟫', 'Solo: Duff Layer', 'Isolated L5 Subsurface Smoldering Duff Horizon');
  } else if (consumePhrases('solo soil', 'show soil', 'mineral soil', 'soil block', 'soil layer', 'soil', 'bedrock', 'roots', 'rhizosphere')) {
    pushAction('setSoloStratum', 6, '🪨', 'Solo: Mineral Soil', 'Isolated L6 Pedological Soil Horizons & Root Network');
  } else if (consumePhrases('solo flux', 'show flux', 'flux layer', 'eddy covariance', 'atmosphere layer', 'fluxes', 'flux', 'troposphere')) {
    pushAction('setSoloStratum', 0, '🌬', 'Solo: Atmospheric Flux', 'Isolated L0 Atmospheric Flux Coupling Vectors');
  }

  // -------------------------------------------------------------------------
  // 8. Monitoring Sites
  // -------------------------------------------------------------------------
  if (consumePhrases('similipal', 'odisha')) {
    pushAction('setSiteById', 'similipal', '📍', 'Site: Similipal BR', 'Loaded Similipal Biosphere Reserve, Odisha');
  } else if (consumePhrases('bandhavgarh', 'madhya pradesh')) {
    pushAction('setSiteById', 'bandhavgarh', '📍', 'Site: Bandhavgarh', 'Loaded Bandhavgarh Tiger Reserve, Madhya Pradesh');
  } else if (consumePhrases('chamba', 'himachal')) {
    pushAction('setSiteById', 'chamba', '📍', 'Site: Chamba HP', 'Loaded Chamba Montane Forest, Himachal Pradesh');
  } else if (consumePhrases('next site', 'change site', 'switch site', 'cycle site')) {
    pushAction('cycleSite', undefined, '🌍', 'Next Site', 'Cycled to next ecological monitoring site');
  }

  // -------------------------------------------------------------------------
  // 9. Guided Scientific Tour (check STOP / OFF before START / ON)
  // -------------------------------------------------------------------------
  if (
    consumePhrases(
      'stop auto tour', 'stop the tour', 'stop guided tour', 'stop tour',
      'end auto tour', 'end the tour', 'end tour',
      'cancel auto tour', 'cancel the tour', 'cancel tour',
      'exit auto tour', 'exit the tour', 'exit tour',
      'turn off auto tour', 'turn off the tour', 'turn off tour',
      'disable auto tour', 'disable tour', 'pause auto tour', 'pause tour'
    ) ||
    consumeRegex(/\b(?:stop|end|cancel|exit|off|disable|pause)\s+(?:the\s+)?(?:auto\s+|guided\s+|cinematic\s+|scientific\s+)?tour\b/i) ||
    consumeRegex(/\b(?:auto\s+|guided\s+)?tour\s+(?:off|stop|end|disable)\b/i)
  ) {
    pushAction('setTour', false, '⏹', 'Tour Stopped', 'Stopped automated scientific dissection tour');
  } else if (consumePhrases('start auto tour', 'start the tour', 'start tour', 'auto tour', 'guided tour', 'cinematic tour', 'play tour', 'begin tour', 'tour')) {
    pushAction('setTour', true, '🎬', 'Auto-Tour Active', 'Started automated 3D phase & layer dissection tour');
  }

  // -------------------------------------------------------------------------
  // 10. Audio Narration (TTS)
  // -------------------------------------------------------------------------
  if (consumePhrases('stop speaking', 'stop narration', 'stop reading', 'be quiet', 'mute', 'silence', 'quiet')) {
    pushAction('stopNarration', undefined, '🔇', 'Muted Narration', 'Stopped voice synthesis playback');
  } else if (consumePhrases('narrate findings', 'read findings', 'audio briefing', 'tell me', 'explain this', 'narrate', 'explain', 'speak', 'briefing', 'summary')) {
    pushAction('narrate', undefined, '🔊', 'Scientific Briefing', 'Speaking site flux metrics & published research findings');
  }

  // -------------------------------------------------------------------------
  // 11. Graphics Performance Tiers (Light vs Full)
  // -------------------------------------------------------------------------
  if (consumePhrases('light mode', 'fast mode', 'performance mode', 'mobile mode', 'battery saver')) {
    pushAction('setPerfTier', 'light', '⚡', 'Light Mode (60 FPS)', 'Switched to Light performance graphics tier');
  } else if (consumePhrases('full mode', 'studio mode', 'ultra mode', 'realistic mode', 'high quality', 'full graphics')) {
    pushAction('setPerfTier', 'full', '💎', 'Full Studio Mode', 'Switched to Full studio graphics tier (36-step raymarch & shadows)');
  }

  // -------------------------------------------------------------------------
  // 12. Zen Mode (check EXIT / OFF before ENTER / ON)
  // -------------------------------------------------------------------------
  if (
    consumePhrases(
      'turn off zen mode', 'turn off zen view', 'turn off zen',
      'switch off zen mode', 'disable zen mode', 'disable zen view', 'disable zen',
      'exit zen mode', 'exit zen view', 'exit zen',
      'leave zen mode', 'leave zen view', 'leave zen',
      'close zen mode', 'close zen view', 'close zen',
      'zen mode off', 'zen off', 'show ui', 'show panels', 'normal view', 'standard view'
    ) ||
    consumeRegex(/\b(?:exit|leave|off|disable|close|stop|end|cancel)\s+(?:the\s+)?zen(?:\s+mode|\s+view)?\b/i) ||
    consumeRegex(/\bzen(?:\s+mode|\s+view)?\s+(?:off|disable|exit|close)\b/i)
  ) {
    pushAction('setZen', false, '👁', 'Standard HUD View', 'Restored UI panels');
  } else if (consumePhrases('zen mode', 'zen view', 'clean view', 'hide ui', 'hide panels', 'full screen', 'zen')) {
    pushAction('setZen', true, '👁', 'Zen Clean View', 'Hidden floating panels for unobstructed 3D visuals');
  }

  // -------------------------------------------------------------------------
  // 13. Simulation Pause/Resume, Camera Reset Fallback, Zoom, Snapshot, Guide
  // -------------------------------------------------------------------------
  if (consumePhrases('pause simulation', 'stop simulation', 'pause', 'freeze')) {
    pushAction('setPaused', true, '⏸', 'Simulation Paused', 'Paused 3D wildfire & atmospheric flux simulation');
  } else if (consumePhrases('resume simulation', 'start simulation', 'unpause', 'resume', 'continue', 'play')) {
    pushAction('setPaused', false, '▶', 'Simulation Active', 'Resumed 3D wildfire & atmospheric flux simulation');
  }

  if (
    !matchedActions.some(a => a.intent === 'resetCamera') &&
    consumePhrases('reset', 'home')
  ) {
    pushAction('resetCamera', undefined, '🎥', 'Camera Reset', 'Returned 3D camera to home perspective');
  }

  if (consumePhrases('zoom in', 'move closer', 'closer')) {
    pushAction('zoom', 0.18, '🔍', 'Zoom In', 'Moved camera closer to forest block');
  } else if (consumePhrases('zoom out', 'move back', 'pull back', 'farther')) {
    pushAction('zoom', -0.18, '🔎', 'Zoom Out', 'Moved camera farther from forest block');
  }

  if (consumePhrases('take snapshot', 'take screenshot', 'take photo', 'snapshot', 'screenshot', 'capture', 'photo')) {
    pushAction('snapshot', undefined, '📸', 'Snapshot Captured', 'Saved 3D forest dissection render image');
  }

  if (consumePhrases('gesture guide', 'voice guide', 'show guide', 'show commands', 'help', 'guide', 'commands')) {
    pushAction('openGuide', undefined, '📖', 'Interaction Guide', 'Opened Hand Gesture & Voice Command Guide');
  }

  return matchedActions;
}

/**
 * Pure, deterministic natural-language parser that converts a spoken transcript
 * into an actionable command intent object (and attaches `actions` for compound utterances).
 *
 * @param {string} rawTranscript - Raw text from SpeechRecognition or quick-command input.
 * @returns {{ matched: boolean, intent: string, param?: any, icon: string, label: string, description: string, transcript: string, actions: Array }}
 */
export function parseVoiceCommand(rawTranscript) {
  if (!rawTranscript || typeof rawTranscript !== 'string') {
    return {
      matched: false,
      intent: 'none',
      icon: '🎙',
      label: 'No Input',
      description: 'Say a command like "Explode", "During fire", or "With camera"',
      transcript: '',
      actions: []
    };
  }

  const clean = rawTranscript.trim();
  if (!clean) {
    return {
      matched: false,
      intent: 'none',
      icon: '🎙',
      label: 'Empty',
      description: 'Say a command like "Explode", "During fire", or "With camera"',
      transcript: '',
      actions: []
    };
  }

  const actions = parseVoiceCommands(rawTranscript);
  if (actions.length === 0) {
    return {
      matched: false,
      intent: 'unknown',
      icon: '❓',
      label: 'Unrecognized',
      description: `Unrecognized: "${rawTranscript}". Try "Explode", "During fire", or "With camera".`,
      transcript: rawTranscript,
      actions: []
    };
  }

  const primary = actions[0];
  return {
    ...primary,
    actions
  };
}

/**
 * Generates a scientific narration script for Web Speech Synthesis (TTS)
 * based on the current site, phase, active flux variable, and solo stratum.
 *
 * @param {object} ctx
 * @returns {string}
 */
export function buildNarrationScript(ctx = {}) {
  const siteName = ctx.site?.name || 'Similipal Biosphere Reserve';
  const phaseKey = ctx.phaseKey || 'during';
  const phaseLabel = ctx.phaseLabel || (phaseKey === 'pre' ? 'Pre-fire' : phaseKey === 'post' ? 'Post-fire' : 'During fire');
  const variable = ctx.variable || 'SH';
  const varMeta = ctx.varMeta || { label: 'Sensible heat flux', unit: 'W m-2' };
  const values = ctx.values || { SH: 100, LH: 60, GPP: 3, ET: 2, VPD: 4, AOD: 1.2 };
  const currentVal = values[variable] !== undefined ? values[variable] : '';
  const explodePct = Math.round((ctx.explode || 0) * 100);

  const sh = Number(values.SH || 60);
  const lh = Number(values.LH || 60);
  const bowen = lh > 0 ? (sh / lh).toFixed(2) : '1.00';

  let text = `${siteName}, ${phaseLabel} phase. `;
  text += `Focused variable is ${varMeta.label}, at ${currentVal} ${varMeta.unit.replace('-', ' per ')}. `;
  text += `Sensible heat is ${sh} watts per square meter, latent heat is ${lh}, yielding a Bowen ratio of ${bowen}. `;

  if (phaseKey === 'during') {
    text += `Active combustion drives strong convective sensible heat updrafts, elevated vapour pressure deficit, and a three-fold surge in aerosol optical depth, while canopy gross primary productivity and evapotranspiration decline. `;
  } else if (phaseKey === 'pre') {
    text += `Under pre-fire baseline conditions, intact Shorea robusta canopy maintains high photosynthetic carbon uptake and evaporative cooling. `;
  } else {
    text += `Post-fire conditions show charred surface litter and gradual recovery of evapotranspiration and canopy carbon assimilation. `;
  }

  if (ctx.stratumCallout && ctx.stratumCallout.name) {
    text += `Currently inspecting layer ${ctx.stratumCallout.tierCode || ''}: ${ctx.stratumCallout.name}. ${ctx.stratumCallout.description || ''} `;
  } else if (explodePct > 10) {
    text += `Forest stratigraphy is dissected to ${explodePct} percent. `;
  }

  return text.trim();
}

/**
 * Speaks a text string using the browser's SpeechSynthesis API if available.
 */
export function speakText(text, options = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    if (!text) return false;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = options.rate || 1.02;
    utter.pitch = options.pitch || 1.0;
    utter.lang = options.lang || 'en-US';
    if (typeof options.onEnd === 'function') {
      utter.onend = options.onEnd;
      utter.onerror = options.onEnd;
    }
    window.speechSynthesis.speak(utter);
    return true;
  } catch (e) {
    console.warn('Speech synthesis error:', e);
    return false;
  }
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      // ignore
    }
  }
}
