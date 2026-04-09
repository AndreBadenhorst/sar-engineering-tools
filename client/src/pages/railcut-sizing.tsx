import { useState, useMemo, useCallback, useRef } from 'react';
import { InputPanel } from '@/components/tools/monorail/input-panel';
import { ResultsTable } from '@/components/tools/monorail/results-table';
import { TimeCurrentChart } from '@/components/tools/monorail/time-current-chart';
import { FuseTripChart } from '@/components/tools/monorail/fuse-trip-chart';
import { AverageSummary } from '@/components/tools/monorail/average-summary';
import { RailAnimation } from '@/components/tools/monorail/rail-animation';
import { DataSources } from '@/components/tools/monorail/data-sources';
import { ExportButton } from '@/components/tools/monorail/export-button';
import {
  deriveValues,
  simulateScenario1,
  simulateScenario2,
} from '@/lib/monorail-engine';
import type { MonorailParams } from '@/lib/monorail-engine';

const DEFAULT_PARAMS: MonorailParams = {
  voltage: 480,
  power_kW: 2.2,
  carrierLength_mm: 2519,
  gap_mm: 500,
  speed_ms: 2.0,
  accelTime_s: 6,
  powerFactor: 0.90,
  railLength_m: 32,
  fuseRating_A: 30,
  brushOffset_mm: 2019, // carrierLength - 500 = 2519 - 500
  totalSystemCarriers: 40,
};

export default function RailcutSizing() {
  const [params, setParams] = useState<MonorailParams>(DEFAULT_PARAMS);

  const handleParamChange = useCallback((key: keyof MonorailParams, value: number) => {
    if (isNaN(value)) return;
    // brushOffset_mm can be 0 (brush at front bumper); other params must be > 0
    if (key === 'brushOffset_mm') {
      if (value < 0) return;
    } else if (key === 'totalSystemCarriers') {
      if (value < 1 || !Number.isInteger(value)) return;
    } else if (value <= 0) return;
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const derived = useMemo(() => deriveValues(params), [params]);

  const scenarios = useMemo(() => {
    const s1 = simulateScenario1(params, derived);
    const s2 = simulateScenario2(params, derived);
    return [s1, s2];
  }, [params, derived]);

  const exportRef = useRef<HTMLDivElement>(null);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Input Panel */}
        <div className="w-full lg:w-80 shrink-0">
          <InputPanel
            params={params}
            derived={derived}
            onParamChange={handleParamChange}
          />
        </div>

        {/* Results Area */}
        <div className="flex-1 space-y-6 min-w-0">
          <div className="flex justify-end">
            <ExportButton targetRef={exportRef} params={params} derived={derived} />
          </div>
          <div ref={exportRef} className="space-y-6">
            {/* Hidden header that only appears in exported image */}
            <div className="export-header hidden" data-export-header>
              <div className="flex items-center justify-between px-4 py-3 bg-gray-800 rounded-lg border border-gray-700">
                <div>
                  <h3 className="text-sm font-semibold text-white">EHB Railcut Power Section Sizing</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {params.voltage}V | {params.power_kW}kW | {params.railLength_m}m section | {params.fuseRating_A}A fuse | {params.carrierLength_mm}mm carrier | {params.speed_ms}m/s | {params.totalSystemCarriers} system carriers
                  </p>
                </div>
                <span className="text-xs text-gray-500">SAR Intranet - Codex</span>
              </div>
            </div>
            <ResultsTable scenarios={scenarios} fuseRating={params.fuseRating_A} derived={derived} totalSystemCarriers={params.totalSystemCarriers} />
            <AverageSummary scenarios={scenarios} fuseRating={params.fuseRating_A} />
            <TimeCurrentChart scenarios={scenarios} fuseRating={params.fuseRating_A} />
            <FuseTripChart scenarios={scenarios} selectedFuseRating={params.fuseRating_A} />
          </div>
          <RailAnimation params={params} derived={derived} />
        </div>
      </div>

      {/* Data Sources */}
      <DataSources />
    </div>
  );
}
