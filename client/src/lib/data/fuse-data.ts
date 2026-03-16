/**
 * Littelfuse KLKR030 — UL Class CC Fast-Acting Fuse, 30 A
 *
 * Time-current data read from the KLKR Series datasheet time-current
 * characteristic curves (average melt) for the 30 A rating.
 *
 * Source: Littelfuse KLKR Series Class CC Fuse Datasheet
 *   https://www.littelfuse.com/products/fuses-overcurrent-protection/fuses/ul-class-fuses/class-cc-fuses/klkr/klkr030
 *   Datasheet PDF (5 pages): pages 4–5 contain time-current curves.
 *   Curves generated from Excel data per note on PDF.
 *
 * Key specifications:
 *   - UL 248-4 Class CC, fast-acting
 *   - 600 VAC, 300 VDC
 *   - 200 kA IR (AC), 20 kA IR (DC)
 *   - Total clearing I²t at 200 kA: 1720 A²s (published value)
 *
 * Cross-referenced against:
 *   - Mersen 107086 (ATMR 8–30 A) melting time-current curves
 *   - UL 248-1 Table 4 overload clearing requirements
 *   - Eaton Bussmann KTK-R-30 (equivalent Class CC fast-acting)
 */

// ---- Anchor Points: 30A Average Melt Curve ----
// Read from Littelfuse KLKR datasheet time-current chart (log-log),
// cross-checked against Mersen 107086 curves.
// Format: [current_A, melt_time_s]
const KLKR030_ANCHORS: [number, number][] = [
  [30,   Infinity], // Rated current — fuse carries indefinitely
  [40,   1000],     // 1.33× In — read from chart
  [50,   80],       // 1.67× In
  [60,   35],       // 2.00× In — UL 248-1 requires clearing ≤ 240 s at 2×In
  [70,   15],       // 2.33× In
  [78,   10],       // 2.6× In
  [90,   5],        // 3.0× In
  [100,  2.5],      // 3.33× In
  [130,  1.0],      // 4.33× In
  [150,  0.5],      // 5.0× In — fast-acting: no minimum hold time
  [200,  0.15],     // 6.67× In
  [250,  0.1],      // 8.33× In
  [300,  0.05],     // 10× In
  [400,  0.03],     // 13.3× In
  [520,  0.01],     // 17.3× In — approaching current-limiting region
];

// Published total clearing I²t at 200 kA (from Littelfuse datasheet)
const CLEARING_I2T = 1720; // A²s

/** The single fuse rating available in this tool */
export const FUSE_RATING = 30;

/** Standard fuse ratings available in the tool (single 30A Class CC) */
export const STANDARD_FUSE_RATINGS = [30] as const;

/** Colors for fuse rating curves on charts */
export const FUSE_COLORS: Record<number, string> = {
  30: '#3b82f6',
};

// ---- Fuse Curve Construction ----
// The curve uses anchor points read from the Littelfuse KLKR030 datasheet
// time-current characteristic (average melt).
//
// Between anchors we interpolate in log-log space (straight line on a
// log-log fuse trip chart — the standard way fuse curves are plotted).
//
// Beyond the last chart-readable anchor, we use the published clearing
// I²t = 1720 A²s for the adiabatic (current-limiting) region.

/** Build the average-melt time-current curve anchor points for the 30A Class CC fuse. */
export function buildFuseCurveAnchors(_fuseRating: number): [number, number][] {
  // We only have one rating (30A), so _fuseRating is accepted for API
  // compatibility but the KLKR030 anchors are always returned.
  const anchors: [number, number][] = [...KLKR030_ANCHORS];

  // Extend into the adiabatic region using I²t = constant
  // Beyond 520A the fuse operates in its current-limiting range
  const lastAnchor = KLKR030_ANCHORS[KLKR030_ANCHORS.length - 1];
  for (const mult of [20, 25, 30, 40, 50]) {
    const I = FUSE_RATING * mult;
    if (I <= lastAnchor[0]) continue;
    const t = CLEARING_I2T / (I * I);
    if (t > 0.0001 && t < lastAnchor[1]) {
      anchors.push([I, t]);
    }
  }

  anchors.sort((a, b) => a[0] - b[0]);
  return anchors;
}

/** Get the fuse trip time for a given current via log-log interpolation */
export function fuseTripTime(current_A: number, fuseRating_A: number, anchors: [number, number][]): number {
  if (current_A <= fuseRating_A) return Infinity;

  for (let i = 1; i < anchors.length; i++) {
    const [c0, t0] = anchors[i - 1];
    const [c1, t1] = anchors[i];
    if (current_A >= c0 && current_A <= c1) {
      if (t0 === Infinity) return t1;
      if (t1 === Infinity) return Infinity;
      // Log-log interpolation
      const logC = Math.log(current_A);
      const logC0 = Math.log(c0);
      const logC1 = Math.log(c1);
      const logT0 = Math.log(t0);
      const logT1 = Math.log(t1);
      const frac = (logC - logC0) / (logC1 - logC0);
      return Math.exp(logT0 + frac * (logT1 - logT0));
    }
  }

  // Beyond last anchor — I²t = constant (adiabatic / current-limiting)
  const last = anchors[anchors.length - 1];
  if (current_A > last[0]) {
    return CLEARING_I2T / (current_A * current_A);
  }
  return Infinity;
}

/** Generate fuse curve points for charting */
export function generateFuseCurveData(fuseRating: number): { x: number; y: number }[] {
  const anchors = buildFuseCurveAnchors(fuseRating);
  const points: { x: number; y: number }[] = [];
  for (let mult = 1.05; mult <= 25; mult += 0.1) {
    const current = fuseRating * mult;
    const time = fuseTripTime(current, fuseRating, anchors);
    if (time < Infinity && time > 0.005 && time < 20000) {
      points.push({ x: current, y: time });
    }
  }
  return points;
}

// ---- Cumulative Damage (Miner's Rule) Trip Model ----
// A fuse is a thermal device.  At each instant the current "uses up" a
// fraction of the fuse element's life according to the time-current curve.
// Miner's linear damage rule: damage += dt / tripTime(I).
// Trip occurs when cumulative damage >= 1.0.
//
// This is physically correct across ALL regions of the fuse curve:
//   - Near overload (1.3–2× In): trip in minutes
//   - Mid-range (3–10× In): trip in 0.05–5 s
//   - Adiabatic region: trip in milliseconds (equivalent to I²t model)
//
// No cooling is modelled — damage only accumulates, never decreases.
// This is conservative (worst-case, fastest trip).
//
// If the waveform is periodic and the simulation (120 s) is too short
// to reach damage = 1.0, we extrapolate: projected trip ≈ simDuration / damage.

export interface I2tTripResult {
  trips: boolean;
  tripTime: number;           // time when trip occurs, or projected trip time, or Infinity
  accumulatedDamage: number;  // cumulative damage fraction (1.0 = trip)
  projectedTripTime: number;  // estimated trip time assuming periodic waveform
}

/**
 * Evaluate whether a waveform would trip the fuse using Miner's cumulative
 * damage rule.  At each timestep: damage += dt / tripTime(I).
 * If current <= In (fuse rating), no damage is added (tripTime = Infinity).
 * Trip occurs when cumulative damage reaches 1.0.
 *
 * If the simulation ends before trip, we extrapolate assuming the waveform
 * repeats: projectedTripTime = simDuration / totalDamage.
 */
export function evaluateI2tTrip(
  timeSteps: number[],
  currents: number[],
  fuseRating: number,
): I2tTripResult {
  const anchors = buildFuseCurveAnchors(fuseRating);
  const dt = timeSteps.length > 1 ? timeSteps[1] - timeSteps[0] : 0.25;

  let damage = 0;

  for (let i = 0; i < currents.length; i++) {
    const I = currents[i];
    if (I <= fuseRating) continue; // No damage below rated current

    const tTrip = fuseTripTime(I, fuseRating, anchors);
    if (tTrip < Infinity && tTrip > 0) {
      damage += dt / tTrip;
    }

    if (damage >= 1.0) {
      // Fuse has tripped
      return {
        trips: true,
        tripTime: timeSteps[i],
        accumulatedDamage: damage,
        projectedTripTime: timeSteps[i],
      };
    }
  }

  // Simulation ended before trip — extrapolate for periodic waveforms
  const simDuration = timeSteps.length > 0
    ? timeSteps[timeSteps.length - 1] - timeSteps[0] + dt
    : 0;

  const projectedTripTime = damage > 0
    ? simDuration / damage
    : Infinity;

  return {
    trips: false,
    tripTime: projectedTripTime, // projected, not actual
    accumulatedDamage: damage,
    projectedTripTime,
  };
}

/** Data sources for citation in UI */
export const FUSE_DATA_SOURCES = [
  {
    title: 'Fuse Trip Curves — Littelfuse KLKR030 Class CC 30 A',
    items: [
      {
        text: 'Littelfuse KLKR030 product page — 30 A, 600 VAC, 200 kA IR, UL 248-4 Class CC, fast-acting',
        url: 'https://www.littelfuse.com/products/fuses-overcurrent-protection/fuses/ul-class-fuses/class-cc-fuses/klkr/klkr030',
      },
      {
        text: 'Littelfuse KLKR Series Datasheet (PDF) — time-current curves (average melt) and I²t clearing data',
        url: 'https://www.littelfuse.com/assetdocs/klkr-classcc-fuse-datasheet-final?assetguid=4443e5f6-97ee-4206-9abe-9e155371a03e',
      },
      {
        text: 'Total clearing I²t at 200 kA: 1720 A²s (published in datasheet electrical specifications table)',
        url: null,
      },
      {
        text: 'Cross-referenced: Mersen 107086 ATMR 30 A melting time-current curves (Cat. No. ATMR30)',
        url: 'https://www.mersen.com/sites/default/files/medias/PIM/files/107086.pdf',
      },
      {
        text: 'UL 248-1 Table 4: 0–30 A fuses must clear within 60 min at 1.35×In, within 4 min at 2.0×In',
        url: null,
      },
      {
        text: 'Trip assessment uses Miner\'s cumulative damage rule: damage += dt/tripTime(I). No cooling — conservative worst-case. Projected trip time extrapolated for periodic waveforms.',
        url: null,
      },
    ],
  },
];
