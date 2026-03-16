/**
 * SEW Movimot Drive Current Profiles
 *
 * Source: SEW-EURODRIVE MOVIMOT MM..D Operating Instructions (Doc 21214190)
 * Section 11 Technical Data — current limit Imax = 160% of rated motor current (IN).
 * Power range: 0.37–4.0 kW, voltage range: 3×380–500 V.
 * The 160% current limit applies during acceleration, deceleration, and load peaks.
 */

/** Inrush multiplier: peak current during acceleration / running current
 *  SEW Movimot current limit = 160% of rated motor current (IN) per
 *  MOVIMOT MM..D Operating Instructions, Doc 21214190, Section 11. */
export const INRUSH_MULTIPLIER = 1.6;

/** Ramp-down time from peak to running current after acceleration.
 *  Matches the acceleration time — the motor current decays from 160% to
 *  100% of rated current over approximately the same interval as the
 *  mechanical ramp.
 *  NOTE: this constant is no longer used. The engine now uses the user's
 *  accelTime_s parameter directly for both ramp-up and ramp-down. */
export const RAMP_DOWN_TIME = 'DEPRECATED' as never;

/** Data sources for citation in UI */
export const DRIVE_DATA_SOURCES = [
  {
    title: 'Carrier Current Model (SEW Movimot)',
    items: [
      {
        text: 'Drive type: SEW-EURODRIVE MOVIMOT® MM..D — integrated geared motor + frequency inverter (0.37–4.0 kW, 3×380–500 V)',
        url: null,
      },
      {
        text: 'Current limit (1.6×): 160% of rated motor current (IN) — MOVIMOT® MM..D Operating Instructions, Section 11 Technical Data',
        url: 'https://download.sew-eurodrive.com/download/pdf/21214190.pdf',
      },
      {
        text: 'Compact Operating Instructions MOVIMOT® MM..D (Doc 21326592)',
        url: 'https://download.sew-eurodrive.com/download/pdf/21326592.pdf',
      },
      {
        text: 'Acceleration profile: linear ramp to full speed; current ramp-down from 160% to 100% over the same acceleration time (VFC motor control mode)',
        url: null,
      },
    ],
  },
];
