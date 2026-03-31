/**
 * Cable Sizing Engine — Power Section Layout & Cable Schedule
 *
 * Pure TypeScript functions for:
 * 1. Dividing a total rail length into power sections + maintenance bays
 * 2. Calculating cable lengths using a right-angle routing model
 * 3. Sizing cables per IEC 60364-5-52 (ampacity + voltage drop)
 * 4. Generating a full cable schedule summary
 *
 * All functions are pure (no side effects) — same pattern as monorail-engine.ts.
 */

import {
  STANDARD_CABLE_SIZES,
  getBaseAmpacity,
  getCableImpedance,
  getTempCorrectionFactor,
  getGroupCorrectionFactor,
  type InstallationMethod,
  type ConductorType,
  type InsulationType,
} from './data/cable-data';

// ─── Constants ───────────────────────────────────────────────────────────────

const SQRT3 = 1.732;

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface MaintenanceBay {
  id: string;
  length_m: number;
  feedPosition: 'start' | 'mid' | 'end';
}

export type FeedPosition = 'start' | 'mid' | 'end';

export interface CableParams {
  // Rail geometry
  totalRailLength_m: number;
  sectionLength_m: number;

  // Maintenance bays
  maintenanceBays: MaintenanceBay[];

  // DB position (geometric model)
  db_perpDistance_m: number;
  db_positionAlongRail_m: number;

  // Route parameters
  verticalDrop_m: number;
  serviceLoopAllowance_m: number;
  bendAdder_m: number;
  defaultFeedPosition: FeedPosition;

  // Installation (IEC 60364-5-52)
  installationMethod: InstallationMethod;
  ambientTemp_C: number;
  groupedCircuits: number;
  cableType: ConductorType;
  insulationType: InsulationType;

  // Electrical
  voltage: number;
  powerFactor: number;
  allowedVoltageDrop_pct: number;

  // Current source
  currentSource: 'manual' | 'from-railcut';
  manualDesignCurrent_A: number;

  // Railcut params (used when currentSource === 'from-railcut')
  carrierPower_kW: number;
  carrierLength_mm: number;
  gap_mm: number;
}

// ─── Output Types ────────────────────────────────────────────────────────────

export interface PowerSection {
  id: string;
  type: 'standard' | 'remainder' | 'maintenance';
  length_m: number;
  startPosition_m: number;
  endPosition_m: number;
  feedPoint_m: number;
  feedPosition: FeedPosition;
  maxCarriersInSection: number;
  designCurrent_A: number;
}

export interface CableSizeResult {
  sectionId: string;
  sectionType: 'standard' | 'remainder' | 'maintenance';
  sectionLength_m: number;
  feedPoint_m: number;

  // Cable length
  calculatedCableLength_m: number;
  overrideCableLength_m: number | null;
  effectiveCableLength_m: number;
  isOverridden: boolean;

  // Design current
  designCurrent_A: number;

  // Ampacity sizing
  ampacitySize_mm2: number;
  baseAmpacity_A: number;
  deratedAmpacity_A: number;
  tempDeratingFactor: number;
  groupDeratingFactor: number;

  // Voltage drop sizing
  vdSize_mm2: number;
  vdAtAmpacitySize_V: number;
  vdAtAmpacitySize_pct: number;

  // Final result
  finalSize_mm2: number;
  finalVoltageDrop_V: number;
  finalVoltageDrop_pct: number;
  sizingBasis: 'ampacity' | 'voltage-drop';
}

export interface CableScheduleSummary {
  sections: PowerSection[];
  cableResults: CableSizeResult[];
  cableTotals: { size_mm2: number; count: number; totalLength_m: number }[];
  totalCableLength_m: number;
  totalSections: number;
  totalMaintenanceBays: number;
  maxVoltageDrop_pct: number;
  worstSection: string;
}

// ─── Derived Values ──────────────────────────────────────────────────────────

export interface CableDerivedValues {
  numStandardSections: number;
  remainderLength_m: number;
  hasRemainder: boolean;
  totalSections: number;
  pitch_m: number;
  runningCurrent_A: number;
  maxCarriersPerStdSection: number;
  designCurrentPerStdSection_A: number;
  tempDeratingFactor: number;
  groupDeratingFactor: number;
  combinedDeratingFactor: number;
}

/**
 * Compute derived values from cable parameters
 */
export function deriveCableValues(p: CableParams): CableDerivedValues {
  const numStandardSections = Math.floor(p.totalRailLength_m / p.sectionLength_m);
  const remainderLength_m = p.totalRailLength_m - numStandardSections * p.sectionLength_m;
  const hasRemainder = remainderLength_m > 0.1; // Threshold to avoid floating point issues
  const totalSections = numStandardSections + (hasRemainder ? 1 : 0) + p.maintenanceBays.length;

  const pitch_m = (p.carrierLength_mm + p.gap_mm) / 1000;
  const runningCurrent_A =
    p.currentSource === 'from-railcut'
      ? (p.carrierPower_kW * 1000) / (SQRT3 * p.voltage * p.powerFactor)
      : 0;
  const maxCarriersPerStdSection =
    p.currentSource === 'from-railcut' ? Math.floor(p.sectionLength_m / pitch_m) : 0;
  const designCurrentPerStdSection_A =
    p.currentSource === 'from-railcut'
      ? maxCarriersPerStdSection * runningCurrent_A
      : p.manualDesignCurrent_A;

  const tempDeratingFactor = getTempCorrectionFactor(p.ambientTemp_C, p.insulationType);
  const groupDeratingFactor = getGroupCorrectionFactor(p.groupedCircuits);
  const combinedDeratingFactor = tempDeratingFactor * groupDeratingFactor;

  return {
    numStandardSections,
    remainderLength_m,
    hasRemainder,
    totalSections,
    pitch_m,
    runningCurrent_A,
    maxCarriersPerStdSection,
    designCurrentPerStdSection_A,
    tempDeratingFactor,
    groupDeratingFactor,
    combinedDeratingFactor,
  };
}

// ─── Section Layout Generation ───────────────────────────────────────────────

/**
 * Divide total rail into power sections + append maintenance bays
 */
export function generateSectionLayout(
  p: CableParams,
  derived: CableDerivedValues,
): PowerSection[] {
  const sections: PowerSection[] = [];
  const pitch_m = derived.pitch_m;

  // Standard sections
  for (let i = 0; i < derived.numStandardSections; i++) {
    const start = i * p.sectionLength_m;
    const end = start + p.sectionLength_m;
    const feedPoint = computeFeedPoint(start, end, p.defaultFeedPosition);
    const maxCarriers =
      p.currentSource === 'from-railcut' ? Math.floor(p.sectionLength_m / pitch_m) : 0;
    const designCurrent =
      p.currentSource === 'from-railcut'
        ? maxCarriers * derived.runningCurrent_A
        : p.manualDesignCurrent_A;

    sections.push({
      id: `PS-${String(i + 1).padStart(2, '0')}`,
      type: 'standard',
      length_m: p.sectionLength_m,
      startPosition_m: start,
      endPosition_m: end,
      feedPoint_m: feedPoint,
      feedPosition: p.defaultFeedPosition,
      maxCarriersInSection: maxCarriers,
      designCurrent_A: designCurrent,
    });
  }

  // Remainder section
  if (derived.hasRemainder) {
    const start = derived.numStandardSections * p.sectionLength_m;
    const end = p.totalRailLength_m;
    const len = derived.remainderLength_m;
    const feedPoint = computeFeedPoint(start, end, p.defaultFeedPosition);
    const maxCarriers =
      p.currentSource === 'from-railcut' ? Math.floor(len / pitch_m) : 0;
    const designCurrent =
      p.currentSource === 'from-railcut'
        ? maxCarriers * derived.runningCurrent_A
        : p.manualDesignCurrent_A;

    sections.push({
      id: `PS-${String(derived.numStandardSections + 1).padStart(2, '0')}`,
      type: 'remainder',
      length_m: len,
      startPosition_m: start,
      endPosition_m: end,
      feedPoint_m: feedPoint,
      feedPosition: p.defaultFeedPosition,
      maxCarriersInSection: maxCarriers,
      designCurrent_A: designCurrent,
    });
  }

  // Maintenance bays — positioned after the main rail
  let mbStart = p.totalRailLength_m;
  for (const bay of p.maintenanceBays) {
    const mbEnd = mbStart + bay.length_m;
    const feedPoint = computeFeedPoint(mbStart, mbEnd, bay.feedPosition);
    const maxCarriers =
      p.currentSource === 'from-railcut' ? Math.floor(bay.length_m / pitch_m) : 0;
    const designCurrent =
      p.currentSource === 'from-railcut'
        ? maxCarriers * derived.runningCurrent_A
        : p.manualDesignCurrent_A;

    sections.push({
      id: bay.id,
      type: 'maintenance',
      length_m: bay.length_m,
      startPosition_m: mbStart,
      endPosition_m: mbEnd,
      feedPoint_m: feedPoint,
      feedPosition: bay.feedPosition,
      maxCarriersInSection: maxCarriers,
      designCurrent_A: designCurrent,
    });
    mbStart = mbEnd;
  }

  return sections;
}

function computeFeedPoint(start: number, end: number, position: FeedPosition): number {
  switch (position) {
    case 'start':
      return start;
    case 'end':
      return end;
    case 'mid':
    default:
      return (start + end) / 2;
  }
}

// ─── Cable Length Calculation ─────────────────────────────────────────────────

/**
 * Calculate cable length using right-angle routing model
 *
 * Cable route: feed point → horizontal run along rail → perpendicular to DB
 * Plus: vertical drop + service loop + bend adder
 */
export function calculateCableLength(section: PowerSection, p: CableParams): number {
  const horizontalRun = Math.abs(section.feedPoint_m - p.db_positionAlongRail_m);
  const perpRun = p.db_perpDistance_m;
  const verticalDrop = p.verticalDrop_m;
  const serviceLoop = p.serviceLoopAllowance_m;
  const bendAdder = p.bendAdder_m;

  return horizontalRun + perpRun + verticalDrop + serviceLoop + bendAdder;
}

// ─── Cable Sizing ────────────────────────────────────────────────────────────

/**
 * Calculate voltage drop for a given cable configuration
 *
 * Formula: ΔV = (√3 × I × L × (R·cosφ + X·sinφ)) / 1000
 * Per IEC 60364-5-52 / AS/NZS 3008.1.1
 *
 * @param current_A - Design current in Amps
 * @param length_m - Cable length in metres (one way)
 * @param size_mm2 - Cable cross-section area
 * @param conductor - Copper or aluminium
 * @param insulation - PVC or XLPE
 * @param powerFactor - cos(φ)
 * @param voltage - Supply voltage (for percentage calculation)
 * @returns { voltageDrop_V, voltageDrop_pct } or null if impedance data unavailable
 */
export function calculateVoltageDrop(
  current_A: number,
  length_m: number,
  size_mm2: number,
  conductor: ConductorType,
  insulation: InsulationType,
  powerFactor: number,
  voltage: number,
): { voltageDrop_V: number; voltageDrop_pct: number } | null {
  const impedance = getCableImpedance(size_mm2, conductor, insulation);
  if (!impedance) return null;

  const cosPhiA = powerFactor;
  const sinPhi = Math.sqrt(1 - cosPhiA * cosPhiA);

  // ΔV = (√3 × I × L × (R·cosφ + X·sinφ)) / 1000
  // L is in metres, R and X are in Ω/km, so divide by 1000
  const voltageDrop_V =
    (SQRT3 * current_A * length_m * (impedance.R * cosPhiA + impedance.X * sinPhi)) / 1000;
  const voltageDrop_pct = (voltageDrop_V / voltage) * 100;

  return { voltageDrop_V, voltageDrop_pct };
}

/**
 * Size a cable for a single power section
 *
 * Logic:
 * 1. Find minimum size by ampacity (derated)
 * 2. Check voltage drop at that size
 * 3. If VD exceeds limit, step up
 * 4. Return final result with both sizing bases
 */
export function sizeCableForSection(
  section: PowerSection,
  effectiveCableLength_m: number,
  overrideCableLength_m: number | null,
  p: CableParams,
  derived: CableDerivedValues,
): CableSizeResult {
  const designCurrent = section.designCurrent_A;
  const tempFactor = derived.tempDeratingFactor;
  const groupFactor = derived.groupDeratingFactor;
  const combinedFactor = tempFactor * groupFactor;

  // Step 1: Find minimum cable size by ampacity
  let ampacitySize_mm2 = STANDARD_CABLE_SIZES[STANDARD_CABLE_SIZES.length - 1]; // Largest as fallback
  let baseAmpacity_A = 0;
  let deratedAmpacity_A = 0;

  for (const size of STANDARD_CABLE_SIZES) {
    const amp = getBaseAmpacity(size, p.cableType, p.insulationType, p.installationMethod);
    if (amp === 0) continue; // Size not available for this config
    const derated = amp * combinedFactor;
    if (derated >= designCurrent) {
      ampacitySize_mm2 = size;
      baseAmpacity_A = amp;
      deratedAmpacity_A = derated;
      break;
    }
  }

  // If no size found by ampacity (loop didn't break), use the largest
  if (baseAmpacity_A === 0) {
    const lastSize = STANDARD_CABLE_SIZES[STANDARD_CABLE_SIZES.length - 1];
    baseAmpacity_A = getBaseAmpacity(lastSize, p.cableType, p.insulationType, p.installationMethod);
    deratedAmpacity_A = baseAmpacity_A * combinedFactor;
    ampacitySize_mm2 = lastSize;
  }

  // Step 2: Calculate VD at ampacity size
  const vdAtAmpacity = calculateVoltageDrop(
    designCurrent,
    effectiveCableLength_m,
    ampacitySize_mm2,
    p.cableType,
    p.insulationType,
    p.powerFactor,
    p.voltage,
  );

  const vdAtAmpacitySize_V = vdAtAmpacity?.voltageDrop_V ?? 0;
  const vdAtAmpacitySize_pct = vdAtAmpacity?.voltageDrop_pct ?? 0;

  // Step 3: Find minimum size by voltage drop
  let vdSize_mm2 = ampacitySize_mm2;

  if (vdAtAmpacitySize_pct > p.allowedVoltageDrop_pct) {
    // Need to upsize for voltage drop
    const startIndex = STANDARD_CABLE_SIZES.indexOf(ampacitySize_mm2);
    for (let i = startIndex + 1; i < STANDARD_CABLE_SIZES.length; i++) {
      const size = STANDARD_CABLE_SIZES[i];
      const vd = calculateVoltageDrop(
        designCurrent,
        effectiveCableLength_m,
        size,
        p.cableType,
        p.insulationType,
        p.powerFactor,
        p.voltage,
      );
      if (vd && vd.voltageDrop_pct <= p.allowedVoltageDrop_pct) {
        vdSize_mm2 = size;
        break;
      }
      // If we've exhausted all sizes, use the largest
      if (i === STANDARD_CABLE_SIZES.length - 1) {
        vdSize_mm2 = size;
      }
    }
  }

  // Step 4: Final size = larger of ampacity and VD sizes
  const finalSize_mm2 = Math.max(ampacitySize_mm2, vdSize_mm2);
  const sizingBasis: 'ampacity' | 'voltage-drop' =
    vdSize_mm2 > ampacitySize_mm2 ? 'voltage-drop' : 'ampacity';

  // Calculate final VD at chosen size
  const finalVd = calculateVoltageDrop(
    designCurrent,
    effectiveCableLength_m,
    finalSize_mm2,
    p.cableType,
    p.insulationType,
    p.powerFactor,
    p.voltage,
  );

  const calculatedLength = calculateCableLength(section, p);

  return {
    sectionId: section.id,
    sectionType: section.type,
    sectionLength_m: section.length_m,
    feedPoint_m: section.feedPoint_m,
    calculatedCableLength_m: calculatedLength,
    overrideCableLength_m: overrideCableLength_m,
    effectiveCableLength_m: effectiveCableLength_m,
    isOverridden: overrideCableLength_m !== null,
    designCurrent_A: designCurrent,
    ampacitySize_mm2,
    baseAmpacity_A,
    deratedAmpacity_A,
    tempDeratingFactor: tempFactor,
    groupDeratingFactor: groupFactor,
    vdSize_mm2,
    vdAtAmpacitySize_V,
    vdAtAmpacitySize_pct,
    finalSize_mm2,
    finalVoltageDrop_V: finalVd?.voltageDrop_V ?? 0,
    finalVoltageDrop_pct: finalVd?.voltageDrop_pct ?? 0,
    sizingBasis,
  };
}

// ─── Full Schedule Computation ───────────────────────────────────────────────

/**
 * Compute the complete cable schedule for all sections
 *
 * @param p - Cable parameters
 * @param overrides - Map of sectionId → overridden cable length (null = use calculated)
 */
export function computeCableSchedule(
  p: CableParams,
  overrides: Map<string, number | null>,
): CableScheduleSummary {
  const derived = deriveCableValues(p);
  const sections = generateSectionLayout(p, derived);

  const cableResults: CableSizeResult[] = sections.map((section) => {
    const calculatedLength = calculateCableLength(section, p);
    const override = overrides.get(section.id) ?? null;
    const effectiveLength = override ?? calculatedLength;

    return sizeCableForSection(section, effectiveLength, override, p, derived);
  });

  // Aggregate totals by cable size
  const sizeMap = new Map<number, { count: number; totalLength: number }>();
  for (const result of cableResults) {
    const existing = sizeMap.get(result.finalSize_mm2) || { count: 0, totalLength: 0 };
    existing.count += 1;
    existing.totalLength += result.effectiveCableLength_m;
    sizeMap.set(result.finalSize_mm2, existing);
  }

  const cableTotals = Array.from(sizeMap.entries())
    .map(([size, data]) => ({
      size_mm2: size,
      count: data.count,
      totalLength_m: Math.round(data.totalLength * 10) / 10,
    }))
    .sort((a, b) => a.size_mm2 - b.size_mm2);

  const totalCableLength_m = cableResults.reduce(
    (sum, r) => sum + r.effectiveCableLength_m,
    0,
  );

  // Find worst-case voltage drop
  let maxVd_pct = 0;
  let worstSection = '';
  for (const result of cableResults) {
    if (result.finalVoltageDrop_pct > maxVd_pct) {
      maxVd_pct = result.finalVoltageDrop_pct;
      worstSection = result.sectionId;
    }
  }

  return {
    sections,
    cableResults,
    cableTotals,
    totalCableLength_m: Math.round(totalCableLength_m * 10) / 10,
    totalSections: sections.filter((s) => s.type !== 'maintenance').length,
    totalMaintenanceBays: sections.filter((s) => s.type === 'maintenance').length,
    maxVoltageDrop_pct: Math.round(maxVd_pct * 100) / 100,
    worstSection,
  };
}

// ─── Default Parameters ──────────────────────────────────────────────────────

export const DEFAULT_CABLE_PARAMS: CableParams = {
  totalRailLength_m: 200,
  sectionLength_m: 32,
  maintenanceBays: [],
  db_perpDistance_m: 5,
  db_positionAlongRail_m: 100,
  verticalDrop_m: 3,
  serviceLoopAllowance_m: 3.0,
  bendAdder_m: 0,
  defaultFeedPosition: 'mid',
  installationMethod: 'E',
  ambientTemp_C: 40,
  groupedCircuits: 1,
  cableType: 'cu',
  insulationType: 'xlpe',
  voltage: 480,
  powerFactor: 0.90,
  allowedVoltageDrop_pct: 3,
  currentSource: 'from-railcut',
  manualDesignCurrent_A: 30,
  carrierPower_kW: 2.2,
  carrierLength_mm: 2519,
  gap_mm: 500,
};

// ─── CSV Export Helper ───────────────────────────────────────────────────────

/**
 * Generate CSV string from cable schedule results
 */
export function generateCableScheduleCSV(summary: CableScheduleSummary): string {
  const headers = [
    'Section ID',
    'Type',
    'Section Length (m)',
    'Feed Point (m)',
    'Cable Length (m)',
    'Length Overridden',
    'Design Current (A)',
    'Ampacity Size (mm²)',
    'VD Size (mm²)',
    'Final Size (mm²)',
    'Voltage Drop (V)',
    'Voltage Drop (%)',
    'Sizing Basis',
  ];

  const rows = summary.cableResults.map((r) => [
    r.sectionId,
    r.sectionType,
    r.sectionLength_m.toFixed(1),
    r.feedPoint_m.toFixed(1),
    r.effectiveCableLength_m.toFixed(1),
    r.isOverridden ? 'Yes' : 'No',
    r.designCurrent_A.toFixed(1),
    r.ampacitySize_mm2.toString(),
    r.vdSize_mm2.toString(),
    r.finalSize_mm2.toString(),
    r.finalVoltageDrop_V.toFixed(2),
    r.finalVoltageDrop_pct.toFixed(2),
    r.sizingBasis,
  ]);

  const csvLines = [headers.join(','), ...rows.map((row) => row.join(','))];

  // Add BOM summary
  csvLines.push('');
  csvLines.push('Cable Bill of Materials');
  csvLines.push('Size (mm²),Number of Runs,Total Length (m)');
  for (const t of summary.cableTotals) {
    csvLines.push(`${t.size_mm2},${t.count},${t.totalLength_m}`);
  }

  return csvLines.join('\n');
}
