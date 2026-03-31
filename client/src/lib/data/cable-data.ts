/**
 * Cable Sizing Data — IEC 60364-5-52:2009
 *
 * All ampacity, resistance, reactance, and derating data sourced from:
 * - IEC 60364-5-52:2009 Tables B.52.2–B.52.5 (current-carrying capacity)
 * - IEC 60364-5-52:2009 Table B.52.14 (temperature correction factors)
 * - IEC 60364-5-52:2009 Table B.52.17 (grouping correction factors)
 * - IEC 60228:2004 / IEC 60364-5-52 Table D.52.1 (conductor resistance & reactance)
 *
 * Cross-referenced with AS/NZS 3008.1.1:2017 (publicly available equivalent tables).
 */

// ─── Standard Cable Sizes (mm²) ─────────────────────────────────────────────

export const STANDARD_CABLE_SIZES: number[] = [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240,
];

// ─── Installation Methods (IEC 60364-5-52 Table B.52.1) ─────────────────────

export type InstallationMethod =
  | 'A1' // Insulated conductors in conduit in thermally insulating wall
  | 'A2' // Multi-core cable in conduit in thermally insulating wall
  | 'B1' // Insulated conductors in conduit on wall / in trunking
  | 'B2' // Multi-core cable in conduit on wall / in trunking
  | 'C'  // Single-core or multi-core cable on wall / single layer on tray
  | 'D1' // Multi-core cable in ground (direct buried)
  | 'E'  // Multi-core cable in free air, single layer on ladder/tray
  | 'F'  // Single-core cables touching, in free air on ladder/tray
  | 'G'; // Single-core cables spaced, in free air on ladder/tray

export const INSTALLATION_METHOD_LABELS: Record<InstallationMethod, string> = {
  A1: 'A1 — Conduit in insulating wall',
  A2: 'A2 — Cable in conduit in insulating wall',
  B1: 'B1 — Conduit on wall / trunking',
  B2: 'B2 — Cable in conduit on wall / trunking',
  C: 'C — Clipped direct / single layer on tray',
  D1: 'D1 — Direct buried in ground',
  E: 'E — Free air, single layer on ladder/tray',
  F: 'F — Single-core touching, free air on ladder',
  G: 'G — Single-core spaced, free air',
};

// ─── Conductor & Insulation Types ────────────────────────────────────────────

export type ConductorType = 'cu' | 'al';
export type InsulationType = 'pvc' | 'xlpe';

export const CONDUCTOR_LABELS: Record<ConductorType, string> = {
  cu: 'Copper (Cu)',
  al: 'Aluminium (Al)',
};

export const INSULATION_LABELS: Record<InsulationType, string> = {
  pvc: 'PVC (70°C)',
  xlpe: 'XLPE (90°C)',
};

// ─── Ampacity Tables (IEC 60364-5-52 Tables B.52.2–B.52.5) ──────────────────
//
// 3-phase circuit ampacity (A) at 30°C ambient, for copper and aluminium
// conductors with PVC or XLPE insulation.
//
// Key: `${conductorType}_${insulationType}` → Record<InstallationMethod, number[]>
// Array indices correspond to STANDARD_CABLE_SIZES indices.
// Value of 0 means that size is not applicable for that method.

interface AmpacityEntry {
  /** Ampacity values indexed same as STANDARD_CABLE_SIZES */
  [method: string]: number[];
}

/**
 * Copper + PVC, 3-phase, IEC 60364-5-52 Table B.52.2 / B.52.4
 * Values in Amps at 30°C ambient
 */
const AMPACITY_CU_PVC: Record<string, number[]> = {
  //           1.5  2.5   4    6   10   16   25   35   50   70   95  120  150  185  240
  A1:       [ 13,  18,  24,  31,  42,  56,  73,  89, 108, 136, 164, 188, 216, 245, 286 ],
  A2:       [ 13,  17.5,23,  29,  39,  52,  68,  83, 101, 128, 154, 176, 202, 230, 269 ],
  B1:       [ 15.5,21,  28,  36,  50,  68,  89, 110, 134, 171, 207, 239, 275, 314, 369 ],
  B2:       [ 15,  20,  27,  34,  46,  62,  80,  99, 119, 151, 182, 210, 240, 273, 321 ],
  C:        [ 17.5,24,  32,  41,  57,  76, 101, 125, 151, 192, 232, 269, 300, 341, 400 ],
  D1:       [ 18,  24,  31,  39,  52,  67,  86, 103, 122, 151, 179, 203, 230, 258, 297 ],
  E:        [ 15.5,21,  28,  36,  50,  68,  89, 110, 134, 171, 207, 239, 275, 314, 369 ],
  F:        [ 17,  23,  31,  40,  55,  73,  95, 117, 144, 184, 223, 259, 299, 341, 403 ],
  G:        [ 19,  26,  35,  45,  62,  84, 110, 137, 169, 217, 264, 308, 356, 409, 485 ],
};

/**
 * Copper + XLPE, 3-phase, IEC 60364-5-52 Table B.52.3 / B.52.5
 */
const AMPACITY_CU_XLPE: Record<string, number[]> = {
  //           1.5  2.5   4    6   10   16   25   35   50   70   95  120  150  185  240
  A1:       [ 17,  23,  31,  40,  54,  73,  95, 117, 141, 179, 216, 249, 285, 324, 380 ],
  A2:       [ 16.5,22,  30,  37,  51,  68,  89, 109, 132, 168, 203, 234, 268, 305, 358 ],
  B1:       [ 19.5,27,  36,  46,  63,  85, 112, 138, 168, 213, 258, 299, 344, 392, 461 ],
  B2:       [ 19,  26,  34,  44,  60,  80, 105, 128, 156, 198, 241, 278, 318, 362, 424 ],
  C:        [ 23,  31,  42,  54,  75, 100, 127, 158, 192, 246, 298, 346, 390, 441, 520 ],
  D1:       [ 22,  29,  37,  46,  61,  79, 101, 121, 143, 177, 210, 238, 270, 303, 349 ],
  E:        [ 19.5,27,  36,  46,  63,  85, 112, 138, 168, 213, 258, 299, 344, 392, 461 ],
  F:        [ 22,  30,  40,  51,  70,  94, 119, 148, 180, 232, 282, 328, 379, 434, 514 ],
  G:        [ 25,  34,  45,  58,  80, 107, 138, 171, 209, 269, 328, 382, 441, 506, 599 ],
};

/**
 * Aluminium + PVC, 3-phase
 * Note: Al cables not available below 16mm² in most standards
 */
const AMPACITY_AL_PVC: Record<string, number[]> = {
  //           1.5  2.5  4    6   10   16   25   35   50   70   95  120  150  185  240
  A1:       [  0,   0,  0,   0,   0,  43,  57,  70,  84, 107, 129, 149, 170, 194, 227 ],
  A2:       [  0,   0,  0,   0,   0,  41,  53,  65,  79, 100, 121, 139, 160, 182, 213 ],
  B1:       [  0,   0,  0,   0,   0,  53,  70,  86, 104, 133, 161, 186, 215, 245, 287 ],
  B2:       [  0,   0,  0,   0,   0,  48,  63,  77,  93, 118, 142, 164, 189, 215, 252 ],
  C:        [  0,   0,  0,   0,   0,  59,  78,  96, 117, 150, 181, 210, 234, 266, 312 ],
  D1:       [  0,   0,  0,   0,   0,  52,  67,  81,  96, 119, 140, 160, 181, 203, 234 ],
  E:        [  0,   0,  0,   0,   0,  53,  70,  86, 104, 133, 161, 186, 215, 245, 287 ],
  F:        [  0,   0,  0,   0,   0,  57,  74,  91, 112, 143, 174, 202, 233, 266, 315 ],
  G:        [  0,   0,  0,   0,   0,  65,  85, 106, 131, 168, 205, 240, 278, 319, 378 ],
};

/**
 * Aluminium + XLPE, 3-phase
 */
const AMPACITY_AL_XLPE: Record<string, number[]> = {
  //           1.5  2.5  4    6   10   16   25   35   50   70   95  120  150  185  240
  A1:       [  0,   0,  0,   0,   0,  57,  74,  91, 110, 140, 170, 197, 226, 256, 300 ],
  A2:       [  0,   0,  0,   0,   0,  53,  70,  86, 104, 133, 161, 186, 213, 242, 284 ],
  B1:       [  0,   0,  0,   0,   0,  66,  87, 107, 131, 167, 202, 234, 269, 307, 360 ],
  B2:       [  0,   0,  0,   0,   0,  62,  81, 100, 122, 156, 189, 218, 250, 285, 334 ],
  C:        [  0,   0,  0,   0,   0,  78,  99, 122, 149, 192, 232, 269, 304, 347, 409 ],
  D1:       [  0,   0,  0,   0,   0,  62,  79,  95, 112, 139, 165, 187, 212, 238, 274 ],
  E:        [  0,   0,  0,   0,   0,  66,  87, 107, 131, 167, 202, 234, 269, 307, 360 ],
  F:        [  0,   0,  0,   0,   0,  73,  93, 115, 140, 181, 220, 257, 297, 340, 403 ],
  G:        [  0,   0,  0,   0,   0,  84, 108, 134, 163, 211, 257, 300, 346, 397, 470 ],
};

/** Master ampacity lookup */
export const AMPACITY_TABLES: Record<string, Record<string, number[]>> = {
  cu_pvc: AMPACITY_CU_PVC,
  cu_xlpe: AMPACITY_CU_XLPE,
  al_pvc: AMPACITY_AL_PVC,
  al_xlpe: AMPACITY_AL_XLPE,
};

/**
 * Get ampacity for a specific cable configuration
 * @returns ampacity in Amps at 30°C ambient, or 0 if not applicable
 */
export function getBaseAmpacity(
  size_mm2: number,
  conductor: ConductorType,
  insulation: InsulationType,
  method: InstallationMethod,
): number {
  const sizeIndex = STANDARD_CABLE_SIZES.indexOf(size_mm2);
  if (sizeIndex === -1) return 0;

  const key = `${conductor}_${insulation}`;
  const table = AMPACITY_TABLES[key];
  if (!table) return 0;

  const methodValues = table[method];
  if (!methodValues) return 0;

  return methodValues[sizeIndex] ?? 0;
}

// ─── Conductor Resistance & Reactance (IEC 60228 / IEC 60364-5-52 Table D.52.1)

interface CableImpedance {
  /** AC resistance at 70°C operating temp in Ω/km (for PVC insulated cables) */
  R_70C: number;
  /** AC resistance at 90°C operating temp in Ω/km (for XLPE insulated cables) */
  R_90C: number;
  /** Reactance in Ω/km (multi-core cables, trefoil formation) */
  X: number;
}

/**
 * Copper conductor impedance data per IEC 60228 / IEC 60364-5-52 Table D.52.1
 * Resistance values include skin effect and proximity effect corrections.
 */
export const CU_IMPEDANCE: Record<number, CableImpedance> = {
  1.5:  { R_70C: 14.48,  R_90C: 15.80,  X: 0.118 },
  2.5:  { R_70C:  8.87,  R_90C:  9.68,  X: 0.109 },
  4:    { R_70C:  5.52,  R_90C:  6.02,  X: 0.104 },
  6:    { R_70C:  3.66,  R_90C:  3.99,  X: 0.099 },
  10:   { R_70C:  2.19,  R_90C:  2.39,  X: 0.094 },
  16:   { R_70C:  1.38,  R_90C:  1.50,  X: 0.090 },
  25:   { R_70C:  0.871, R_90C:  0.950, X: 0.086 },
  35:   { R_70C:  0.627, R_90C:  0.684, X: 0.083 },
  50:   { R_70C:  0.464, R_90C:  0.506, X: 0.082 },
  70:   { R_70C:  0.321, R_90C:  0.350, X: 0.080 },
  95:   { R_70C:  0.236, R_90C:  0.258, X: 0.079 },
  120:  { R_70C:  0.188, R_90C:  0.205, X: 0.078 },
  150:  { R_70C:  0.153, R_90C:  0.167, X: 0.078 },
  185:  { R_70C:  0.123, R_90C:  0.134, X: 0.077 },
  240:  { R_70C:  0.0943,R_90C:  0.103, X: 0.077 },
};

/**
 * Aluminium conductor impedance data per IEC 60228
 * Al resistivity ≈ 1.64× Cu
 */
export const AL_IMPEDANCE: Record<number, CableImpedance> = {
  16:   { R_70C:  2.27,  R_90C:  2.47,  X: 0.090 },
  25:   { R_70C:  1.44,  R_90C:  1.57,  X: 0.086 },
  35:   { R_70C:  1.04,  R_90C:  1.13,  X: 0.083 },
  50:   { R_70C:  0.764, R_90C:  0.834, X: 0.082 },
  70:   { R_70C:  0.530, R_90C:  0.578, X: 0.080 },
  95:   { R_70C:  0.390, R_90C:  0.426, X: 0.079 },
  120:  { R_70C:  0.310, R_90C:  0.338, X: 0.078 },
  150:  { R_70C:  0.253, R_90C:  0.276, X: 0.078 },
  185:  { R_70C:  0.203, R_90C:  0.221, X: 0.077 },
  240:  { R_70C:  0.156, R_90C:  0.170, X: 0.077 },
};

/**
 * Get resistance and reactance for a cable
 * @returns { R: Ω/km, X: Ω/km } at operating temperature
 */
export function getCableImpedance(
  size_mm2: number,
  conductor: ConductorType,
  insulation: InsulationType,
): { R: number; X: number } | null {
  const table = conductor === 'cu' ? CU_IMPEDANCE : AL_IMPEDANCE;
  const data = table[size_mm2];
  if (!data) return null;

  const R = insulation === 'pvc' ? data.R_70C : data.R_90C;
  return { R, X: data.X };
}

// ─── Temperature Correction Factors (IEC 60364-5-52 Table B.52.14) ──────────
//
// Base ambient temperature: 30°C for cables in air
// Correction factor applied to ampacity when ambient differs from 30°C

interface TempCorrectionEntry {
  ambient_C: number;
  pvc: number;   // For PVC (70°C max operating temp)
  xlpe: number;  // For XLPE (90°C max operating temp)
}

/**
 * Temperature correction factors — IEC 60364-5-52 Table B.52.14
 * For cables in air (base 30°C ambient)
 */
export const TEMP_CORRECTION_TABLE: TempCorrectionEntry[] = [
  { ambient_C: 10, pvc: 1.22, xlpe: 1.15 },
  { ambient_C: 15, pvc: 1.17, xlpe: 1.12 },
  { ambient_C: 20, pvc: 1.12, xlpe: 1.08 },
  { ambient_C: 25, pvc: 1.06, xlpe: 1.04 },
  { ambient_C: 30, pvc: 1.00, xlpe: 1.00 },
  { ambient_C: 35, pvc: 0.94, xlpe: 0.96 },
  { ambient_C: 40, pvc: 0.87, xlpe: 0.91 },
  { ambient_C: 45, pvc: 0.79, xlpe: 0.87 },
  { ambient_C: 50, pvc: 0.71, xlpe: 0.82 },
  { ambient_C: 55, pvc: 0.61, xlpe: 0.76 },
  { ambient_C: 60, pvc: 0.50, xlpe: 0.71 },
];

/**
 * Get temperature correction factor by linear interpolation
 */
export function getTempCorrectionFactor(
  ambient_C: number,
  insulation: InsulationType,
): number {
  const table = TEMP_CORRECTION_TABLE;
  const key = insulation === 'pvc' ? 'pvc' : 'xlpe';

  // Clamp to table range
  if (ambient_C <= table[0].ambient_C) return table[0][key];
  if (ambient_C >= table[table.length - 1].ambient_C) return table[table.length - 1][key];

  // Linear interpolation
  for (let i = 0; i < table.length - 1; i++) {
    if (ambient_C >= table[i].ambient_C && ambient_C <= table[i + 1].ambient_C) {
      const t0 = table[i].ambient_C;
      const t1 = table[i + 1].ambient_C;
      const f0 = table[i][key];
      const f1 = table[i + 1][key];
      return f0 + ((ambient_C - t0) / (t1 - t0)) * (f1 - f0);
    }
  }

  return 1.0; // Fallback
}

// ─── Grouping Correction Factors (IEC 60364-5-52 Table B.52.17) ─────────────
//
// When multiple circuits are bundled/grouped together, each circuit's
// ampacity is derated due to mutual heating.

interface GroupCorrectionEntry {
  circuits: number;
  factor: number;
}

/**
 * Grouping correction factors — IEC 60364-5-52 Table B.52.17
 * For cables on trays/ladders, single layer (most common EHB installation)
 */
export const GROUP_CORRECTION_TABLE: GroupCorrectionEntry[] = [
  { circuits: 1,  factor: 1.00 },
  { circuits: 2,  factor: 0.80 },
  { circuits: 3,  factor: 0.70 },
  { circuits: 4,  factor: 0.65 },
  { circuits: 5,  factor: 0.60 },
  { circuits: 6,  factor: 0.57 },
  { circuits: 7,  factor: 0.54 },
  { circuits: 8,  factor: 0.52 },
  { circuits: 9,  factor: 0.50 },
  { circuits: 12, factor: 0.45 },
  { circuits: 16, factor: 0.41 },
  { circuits: 20, factor: 0.38 },
];

/**
 * Get grouping correction factor by linear interpolation
 */
export function getGroupCorrectionFactor(circuits: number): number {
  if (circuits <= 1) return 1.0;

  const table = GROUP_CORRECTION_TABLE;
  if (circuits >= table[table.length - 1].circuits) {
    return table[table.length - 1].factor;
  }

  for (let i = 0; i < table.length - 1; i++) {
    if (circuits >= table[i].circuits && circuits <= table[i + 1].circuits) {
      const n0 = table[i].circuits;
      const n1 = table[i + 1].circuits;
      const f0 = table[i].factor;
      const f1 = table[i + 1].factor;
      return f0 + ((circuits - n0) / (n1 - n0)) * (f1 - f0);
    }
  }

  return 1.0;
}

// ─── Data Sources (for DataSources component — Hard Rule 7) ──────────────────

export const CABLE_DATA_SOURCES = [
  {
    title: 'IEC 60364-5-52:2009',
    description:
      'Low-voltage electrical installations — Part 5-52: Selection and erection of electrical equipment — Wiring systems. Tables B.52.2–B.52.5 (ampacity), B.52.14 (temperature correction), B.52.17 (grouping correction).',
    url: 'https://webstore.iec.ch/en/publication/1878',
  },
  {
    title: 'IEC 60228:2004',
    description:
      'Conductors of insulated cables. Defines standard conductor sizes and DC resistance values used as the basis for AC resistance calculations.',
    url: 'https://webstore.iec.ch/en/publication/1044',
  },
  {
    title: 'AS/NZS 3008.1.1:2017',
    description:
      'Electrical installations — Selection of cables. Publicly available equivalent to IEC 60364-5-52 tables. Cross-reference for ampacity and voltage drop data.',
    url: 'https://www.standards.org.au/standards-catalogue/sa-snz/electrotechnology/el-001/as-slash-nzs--3008-dot-1-dot-1-colon-2017',
  },
  {
    title: 'Nexans Power Cable Technical Data',
    description:
      'Publicly available cable resistance and reactance tables per IEC 60228. Used to cross-check conductor impedance values.',
    url: 'https://www.nexans.com/en/',
  },
];
