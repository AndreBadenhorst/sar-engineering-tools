/**
 * Monorail Power Section Sizing — Simulation Engine
 * Ported from monorail-tool/app.js (1010 lines) into typed module.
 */

import {
  buildFuseCurveAnchors,
  fuseTripTime,
  generateFuseCurveData,
  evaluateI2tTrip,
  FUSE_COLORS,
  STANDARD_FUSE_RATINGS,
  FUSE_RATING,
} from '@/lib/data/fuse-data';
import type { I2tTripResult } from '@/lib/data/fuse-data';
import { INRUSH_MULTIPLIER } from '@/lib/data/drive-curves';

// ---- Constants ----
export const SQRT3 = 1.732;
export const SIM_DURATION = 120;
export const TIME_STEP = 0.25;

export const SCENARIO_COLORS = {
  1: { line: '#2dd4bf', bg: 'rgba(45,212,191,0.15)', avgLine: '#14b8a6' },
  2: { line: '#f59e0b', bg: 'rgba(245,158,11,0.15)', avgLine: '#d97706' },
} as const;

export { FUSE_COLORS, STANDARD_FUSE_RATINGS, FUSE_RATING, generateFuseCurveData, buildFuseCurveAnchors, fuseTripTime, evaluateI2tTrip };
export type { I2tTripResult };

// ---- Types ----
export interface MonorailParams {
  voltage: number;
  power_kW: number;
  carrierLength_mm: number;
  gap_mm: number;
  speed_ms: number;
  accelTime_s: number;
  powerFactor: number;
  railLength_m: number;
  fuseRating_A: number;
  /** Brush (current collector) offset from the front bumper of the carrier (mm).
   *  Determines which power section supplies the carrier.
   *  Default: carrierLength_mm - 500 (brush 500 mm from the back). */
  brushOffset_mm: number;
  /** Total number of carriers on the full system (across all power sections).
   *  Used to compute total system current load. */
  totalSystemCarriers: number;
}
// NOTE: numCarriers is NOT a param — it is purely derived from railLength / pitch.

export interface DerivedValues {
  pitch_mm: number;
  pitch_m: number;
  /** Carriers that fit in this section: floor(railLength / pitch) */
  numCarriers: number;
  runningCurrent: number;
  peakCurrent: number;
  accel: number;
  /** Brush offset in metres (brushOffset_mm / 1000) */
  brushOffset_m: number;
  /** Carrier length in metres */
  carrierLen_m: number;
  /** Full system running current: totalSystemCarriers × runningCurrent */
  totalSystemCurrent: number;
}

export interface ScenarioResult {
  timeSteps: number[];
  currents: number[];
  /** Running (cumulative) average current at each timestep */
  runningAvg: number[];
  /** Overall time-weighted average current across the full simulation */
  avgCurrent: number;
  peakCurrent: number;
  peakDuration: number;
  name: string;
}

export interface CarrierState {
  position: number; // 0..1 relative to section (front bumper)
  brushPosition: number; // 0..1 relative to section (brush/current collector)
  state: 'accelerating' | 'running' | 'stopped';
  current: number;
}

// ---- Derived Values ----
export function deriveValues(p: MonorailParams): DerivedValues {
  const pitch_mm = p.carrierLength_mm + p.gap_mm;
  const pitch_m = pitch_mm / 1000;
  const numCarriers = Math.floor(p.railLength_m / pitch_m);
  const runningCurrent = (p.power_kW * 1000) / (SQRT3 * p.voltage * p.powerFactor);
  const peakCurrent = runningCurrent * INRUSH_MULTIPLIER;
  const accel = p.speed_ms / p.accelTime_s;
  const brushOffset_m = p.brushOffset_mm / 1000;
  const carrierLen_m = p.carrierLength_mm / 1000;
  const totalSystemCurrent = p.totalSystemCarriers * runningCurrent;
  return { pitch_mm, pitch_m, numCarriers, runningCurrent, peakCurrent, accel, brushOffset_m, carrierLen_m, totalSystemCurrent };
}

// ---- Carrier Position Model ----
export function carrierDistanceTravelled(timeSinceStart: number, speed: number, accelTime: number): number {
  if (timeSinceStart <= 0) return 0;
  const accel = speed / accelTime;
  if (timeSinceStart <= accelTime) {
    return 0.5 * accel * timeSinceStart * timeSinceStart;
  }
  const accelDist = 0.5 * speed * accelTime;
  return accelDist + speed * (timeSinceStart - accelTime);
}

// ---- Carrier Current Model ----
// During acceleration the motor draws peak current (160% of rated).
// After reaching full speed the current ramps down to running current
// over the same duration as the acceleration time.
export function carrierCurrentAtTime(
  timeSinceStart: number,
  accelTime: number,
  runningCurrent: number,
  peakCurrent: number,
): number {
  if (timeSinceStart < 0) return 0;
  if (timeSinceStart <= accelTime) {
    return peakCurrent;
  }
  // Ramp-down from peak to running over accelTime (matches ramp-up duration)
  const rampDownTime = accelTime;
  if (timeSinceStart <= accelTime + rampDownTime) {
    const rampProgress = (timeSinceStart - accelTime) / rampDownTime;
    return peakCurrent - (peakCurrent - runningCurrent) * rampProgress;
  }
  return runningCurrent;
}

// ---- Peak-duration helper ----
// Finds the longest continuous span where current >= 95% of peak.
// For repeating oscillations this gives the width of one peak pulse.
function longestPeakSpan(currents: number[], peakCurrent: number, dt: number): number {
  if (peakCurrent <= 0) return 0;
  const threshold = peakCurrent * 0.95;
  let longest = 0;
  let runLen = 0;
  for (let i = 0; i < currents.length; i++) {
    if (currents[i] >= threshold) {
      runLen++;
      if (runLen > longest) longest = runLen;
    } else {
      runLen = 0;
    }
  }
  return Math.max(longest * dt, dt);
}

// ---- Running average helper ----
// Computes the cumulative (time-weighted) average at each timestep.
function computeRunningAvg(currents: number[]): { runningAvg: number[]; avgCurrent: number } {
  const runningAvg: number[] = [];
  let cumSum = 0;
  for (let i = 0; i < currents.length; i++) {
    cumSum += currents[i];
    runningAvg.push(cumSum / (i + 1));
  }
  const avgCurrent = currents.length > 0 ? cumSum / currents.length : 0;
  return { runningAvg, avgCurrent };
}

// ---- Brush-in-section helper ----
// Returns true when the carrier's brush is inside the power section [0, railLength_m].
function brushInSection(carrierFrontPos_m: number, brushOffset_m: number, railLength_m: number): boolean {
  const brushPos = carrierFrontPos_m + brushOffset_m;
  return brushPos >= 0 && brushPos <= railLength_m;
}

// ---- Scenario 1: Full Speed Flow ----
// Carriers flow continuously at full speed through the section. An infinite
// stream of carriers, spaced at exactly one pitch, moves right at constant
// velocity. At each timestep we count how many brushes are inside the
// power section [0, railLength_m]. The count oscillates between
// floor(L/pitch) and floor(L/pitch)+1 depending on alignment phase.
export function simulateScenario1(p: MonorailParams, d: DerivedValues): ScenarioResult {
  const timeSteps: number[] = [];
  const currents: number[] = [];

  const brushPos_m = d.brushOffset_m; // brush offset from front bumper

  // We model an unbounded stream. A brush is at position:
  //   brush_i = i * pitch + speed * t + brushOffset
  // Brush is in-section when brush_i ∈ [0, railLength].
  // Front-bumper position: front_i = i * pitch + speed * t
  // Brush position:        brush_i = front_i + brushOffset
  // Brush in section when: 0 ≤ front_i + brushOffset ≤ railLength
  // i.e. front_i ∈ [-brushOffset, railLength - brushOffset]
  //
  // At each timestep, we only need to check carriers whose front-bumper
  // falls in a window slightly larger than the section. We pick a generous
  // range of carrier indices that could possibly have their brush in-section.

  for (let t = 0; t <= SIM_DURATION; t += TIME_STEP) {
    // Phase = fractional position within one pitch cycle
    const phase = (p.speed_ms * t) % d.pitch_m;
    let count = 0;

    // Check enough carriers to cover the section plus margin.
    // Front-bumper of carrier i at time t = i * pitch + phase (modulo stream).
    // We need front positions roughly in [-brushOffset - pitch, railLength + pitch].
    const iMin = Math.floor((-brushPos_m - d.pitch_m) / d.pitch_m);
    const iMax = Math.ceil((p.railLength_m + d.pitch_m) / d.pitch_m);

    for (let i = iMin; i <= iMax; i++) {
      const frontPos = i * d.pitch_m + phase;
      if (brushInSection(frontPos, brushPos_m, p.railLength_m)) {
        count++;
      }
    }
    timeSteps.push(t);
    currents.push(count * d.runningCurrent);
  }

  const peakCurrent = Math.max(...currents);
  const peakDuration = longestPeakSpan(currents, peakCurrent, TIME_STEP);
  const { runningAvg, avgCurrent } = computeRunningAvg(currents);
  return { timeSteps, currents, runningAvg, avgCurrent, peakCurrent, peakDuration, name: 'Full Speed Flow' };
}

// ---- Scenario 2: Parked Then Sequential Pull-Off ----
// PHYSICS: Carriers are parked at pitch spacing. The carrier closest to the
// EXIT (rightmost, index numCarriers-1) departs first at t=0. Each subsequent
// carrier behind it follows 1 second later. All use the same acceleration.
// Departure order index: carrier (numCarriers-1) at t=0, carrier (numCarriers-2)
// at t=1s, ... carrier 0 at t=(numCarriers-1)s.
export function simulateScenario2(p: MonorailParams, d: DerivedValues): ScenarioResult {
  const timeSteps: number[] = [];
  const currents: number[] = [];
  const numCarriers = d.numCarriers;
  const startDelay = 1.0;

  for (let t = 0; t <= SIM_DURATION; t += TIME_STEP) {
    let totalCurrent = 0;
    for (let i = 0; i < numCarriers; i++) {
      // Departure order: last carrier (closest to exit) leaves first.
      // Carrier i's departure sequence position = (numCarriers - 1 - i)
      // so carrier (numCarriers-1) departs at t=0, carrier 0 departs last.
      const departureOrder = numCarriers - 1 - i;
      const carrierStartTime = departureOrder * startDelay;
      const timeSinceStart = t - carrierStartTime;

      if (timeSinceStart < 0) continue;

      // Front-bumper position of carrier i
      const parkedPosition = i * d.pitch_m;
      const distTravelled = carrierDistanceTravelled(timeSinceStart, p.speed_ms, p.accelTime_s);
      const frontPos = parkedPosition + distTravelled;

      // Only count this carrier if its BRUSH is inside this section
      if (!brushInSection(frontPos, d.brushOffset_m, p.railLength_m)) continue;

      totalCurrent += carrierCurrentAtTime(timeSinceStart, p.accelTime_s, d.runningCurrent, d.peakCurrent);
    }
    timeSteps.push(t);
    currents.push(totalCurrent);
  }

  const peakCurrent = Math.max(...currents);
  const peakDuration = longestPeakSpan(currents, peakCurrent, TIME_STEP);
  const { runningAvg, avgCurrent } = computeRunningAvg(currents);
  return { timeSteps, currents, runningAvg, avgCurrent, peakCurrent, peakDuration, name: 'Sequential Pull-Off' };
}

// ---- Fuse Trip Status ----
// Uses Miner's cumulative damage rule against the Littelfuse KLKR030
// Class CC 30A time-current curve.  damage += dt / tripTime(I) at each
// step.  Trip when damage >= 1.0.
// If the simulation is too short, extrapolate for periodic waveforms.
export type TripStatus = 'SAFE' | 'WARNING' | 'TRIP';

export function getTripStatus(
  scenario: ScenarioResult,
  fuseRating: number,
): { status: TripStatus; tripTime: number; i2tResult: I2tTripResult } {
  const i2tResult = evaluateI2tTrip(scenario.timeSteps, scenario.currents, fuseRating);

  let status: TripStatus;
  if (i2tResult.trips) {
    // Tripped within the simulation window
    status = 'TRIP';
  } else if (i2tResult.accumulatedDamage > 0) {
    // Damage is accumulating — the fuse WILL trip eventually.
    // Any non-zero damage means overcurrent was detected, so warn regardless
    // of projected trip time (conservative approach).
    status = 'WARNING';
  } else if (scenario.peakCurrent > fuseRating) {
    // Peak exceeds rating but damage calc says zero — shouldn't happen
    // but keep as safety net
    status = 'WARNING';
  } else {
    status = 'SAFE';
  }

  return {
    status,
    tripTime: i2tResult.tripTime,
    i2tResult,
  };
}

// ---- Animation: Carrier States ----
export function getCarrierStatesAtTime(
  t: number,
  scenarioIndex: number,
  p: MonorailParams,
  d: DerivedValues,
): CarrierState[] {
  const carriers: CarrierState[] = [];
  const numCarriers = d.numCarriers;
  const brushOff_m = d.brushOffset_m;

  if (scenarioIndex === 0) {
    // Scenario 1: Full speed flow — unbounded continuous stream.
    // Carriers are spaced at pitch intervals moving at constant speed.
    // We render those whose body is at least partially visible in the section.
    const carrierLen_m = p.carrierLength_mm / 1000;
    const phase = (p.speed_ms * t) % d.pitch_m;
    // Range of carrier indices whose body could overlap [0, railLength]
    const iMin = Math.floor((-brushOff_m - d.pitch_m - carrierLen_m) / d.pitch_m);
    const iMax = Math.ceil((p.railLength_m + d.pitch_m + carrierLen_m) / d.pitch_m);

    for (let i = iMin; i <= iMax; i++) {
      const frontPos = i * d.pitch_m + phase;
      const tailPos = frontPos + carrierLen_m;
      // Show carrier if its body overlaps the visible section area
      if (tailPos >= 0 && frontPos <= p.railLength_m) {
        const brushAbs = frontPos + brushOff_m;
        carriers.push({
          position: frontPos / p.railLength_m,
          brushPosition: brushAbs / p.railLength_m,
          state: 'running',
          current: brushInSection(frontPos, brushOff_m, p.railLength_m) ? d.runningCurrent : 0,
        });
      }
    }
  } else if (scenarioIndex === 1) {
    // Scenario 2: Parked then sequential pull-off
    // Exit-first departure: carrier (numCarriers-1) leaves at t=0
    const startDelay = 1.0;
    for (let i = 0; i < numCarriers; i++) {
      const departureOrder = numCarriers - 1 - i;
      const carrierStartTime = departureOrder * startDelay;
      const timeSinceStart = t - carrierStartTime;
      const parkedPosition = i * d.pitch_m;

      let distTravelled = 0;
      let state: CarrierState['state'] = 'stopped';
      let current = 0;

      if (timeSinceStart < 0) {
        state = 'stopped';
        current = 0;
      } else if (timeSinceStart <= p.accelTime_s) {
        state = 'accelerating';
        current = d.peakCurrent;
        distTravelled = carrierDistanceTravelled(timeSinceStart, p.speed_ms, p.accelTime_s);
      } else {
        distTravelled = carrierDistanceTravelled(timeSinceStart, p.speed_ms, p.accelTime_s);
        // Ramp-down phase: same duration as acceleration
        if (timeSinceStart <= p.accelTime_s + p.accelTime_s) {
          state = 'accelerating';
          const rampProgress = (timeSinceStart - p.accelTime_s) / p.accelTime_s;
          current = d.peakCurrent - (d.peakCurrent - d.runningCurrent) * rampProgress;
        } else {
          state = 'running';
          current = d.runningCurrent;
        }
      }

      const absolutePos = parkedPosition + distTravelled;
      // Check if brush is in section — if not, carrier draws zero from this section
      const brushInSec = brushInSection(absolutePos, brushOff_m, p.railLength_m);
      if (!brushInSec && state === 'stopped') {
        // parked carrier whose brush is off-section — skip
      }
      if (absolutePos <= p.railLength_m + d.pitch_m) {
        const brushAbs = absolutePos + brushOff_m;
        carriers.push({
          position: absolutePos / p.railLength_m,
          brushPosition: brushAbs / p.railLength_m,
          state,
          current: brushInSec ? current : 0,
        });
      }
    }
  }

  return carriers;
}

// ---- Canvas Drawing ----
export function drawRailAnimation(
  canvas: HTMLCanvasElement,
  t: number,
  scenarioIndex: number,
  p: MonorailParams,
  d: DerivedValues,
): { totalCurrent: number; carrierCount: number } {
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width;
  const H = rect.height;

  ctx.fillStyle = '#171923';
  ctx.fillRect(0, 0, W, H);

  const railMargin = 60;
  const railY = H / 2;
  const railH = 12;
  const railX = railMargin;
  const railW = W - railMargin * 2;

  // Rail
  ctx.fillStyle = '#2d3148';
  ctx.fillRect(railX, railY - railH / 2, railW, railH);

  // Section boundaries
  ctx.strokeStyle = '#4a9ece';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(railX, railY - 40);
  ctx.lineTo(railX, railY + 40);
  ctx.moveTo(railX + railW, railY - 40);
  ctx.lineTo(railX + railW, railY + 40);
  ctx.stroke();
  ctx.setLineDash([]);

  // Labels
  ctx.fillStyle = '#6b7294';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ENTRY', railX, railY + 55);
  ctx.fillText('EXIT', railX + railW, railY + 55);
  ctx.fillText(`${p.railLength_m} m`, railX + railW / 2, railY + 55);

  // Carriers
  const carriers = getCarrierStatesAtTime(t, scenarioIndex, p, d);
  // Carrier visual length in pixels — maps physical carrier length to rail width
  const carrierVisualLength = Math.max(12, (d.carrierLen_m / p.railLength_m) * railW);
  // Brush visual offset within the carrier body (pixels from LEFT edge)
  const brushVisualOffset = (d.brushOffset_m / d.carrierLen_m) * carrierVisualLength;
  const carrierH = 28;

  carriers.forEach((c) => {
    // c.position is front-bumper position as fraction of railLength.
    // The front bumper is the LEFT edge of the carrier body.
    const carrierLeftX = railX + c.position * railW;
    let color: string;
    if (c.state === 'accelerating') color = '#ef4444';
    else if (c.state === 'running') color = '#3b82f6';
    else color = '#4b5563';

    // Dim carrier if its brush is outside the section (draws 0 A)
    const brushActive = c.current > 0.01;
    ctx.globalAlpha = brushActive ? 1.0 : 0.35;

    ctx.fillStyle = color;
    const ry = railY - carrierH / 2;
    roundRect(ctx, carrierLeftX, ry, carrierVisualLength, carrierH, 3);
    ctx.fill();

    // Brush marker — small yellow triangle pointing down to the rail.
    // Brush is FIXED on the carrier body at brushOffset from the front bumper.
    const brushX = carrierLeftX + brushVisualOffset;
    // Only draw brush marker if it's within the visible canvas area (with small margin)
    if (brushX >= railX - 10 && brushX <= railX + railW + 10) {
      const brushW = 6;
      const brushTop = ry; // top of carrier box
      ctx.fillStyle = '#facc15'; // yellow
      ctx.beginPath();
      ctx.moveTo(brushX, brushTop);
      ctx.lineTo(brushX - brushW / 2, brushTop - 7);
      ctx.lineTo(brushX + brushW / 2, brushTop - 7);
      ctx.closePath();
      ctx.fill();
      // Brush contact line
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(brushX, brushTop);
      ctx.lineTo(brushX, railY - railH / 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1.0;

    // Current label — centered on the carrier body
    if (c.current > 0.1) {
      ctx.fillStyle = '#e8eaf0';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${c.current.toFixed(1)}A`, carrierLeftX + carrierVisualLength / 2, ry - 10);
    }
  });

  // Legend
  ctx.font = '10px Inter, sans-serif';
  const legendY = 16;
  const legends = [
    { color: '#ef4444', label: 'Accelerating' },
    { color: '#3b82f6', label: 'Running' },
    { color: '#4b5563', label: 'Stopped' },
    { color: '#facc15', label: 'Brush' },
  ];
  let lx = railX;
  legends.forEach((l) => {
    if (l.label === 'Brush') {
      // Draw a small triangle for the brush legend
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.moveTo(lx + 5, legendY - 8);
      ctx.lineTo(lx, legendY + 2);
      ctx.lineTo(lx + 10, legendY + 2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = l.color;
      ctx.fillRect(lx, legendY - 8, 10, 10);
    }
    ctx.fillStyle = '#9ca3b8';
    ctx.textAlign = 'left';
    ctx.fillText(l.label, lx + 14, legendY);
    lx += ctx.measureText(l.label).width + 28;
  });

  const totalCurrent = carriers.reduce((s, c) => s + c.current, 0);
  return { totalCurrent, carrierCount: carriers.length };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
