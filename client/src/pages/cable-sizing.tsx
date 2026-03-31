import { useState, useMemo, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CableInputPanel } from '@/components/tools/cable/input-panel';
import { CableScheduleTable } from '@/components/tools/cable/cable-schedule-table';
import { SectionLayout } from '@/components/tools/cable/section-layout';
import { VoltageDropChart } from '@/components/tools/cable/voltage-drop-chart';
import { CableSummary } from '@/components/tools/cable/cable-summary';
import { CableDataSources } from '@/components/tools/cable/data-sources';
import { CableExportButton } from '@/components/tools/cable/export-button';
import {
  type CableParams,
  DEFAULT_CABLE_PARAMS,
  deriveCableValues,
  computeCableSchedule,
} from '@/lib/cable-engine';

export default function CableSizing() {
  const [params, setParams] = useState<CableParams>(DEFAULT_CABLE_PARAMS);
  const [overrides, setOverrides] = useState<Map<string, number | null>>(new Map());
  const exportRef = useRef<HTMLDivElement>(null);

  const handleParamChange = <K extends keyof CableParams>(key: K, value: CableParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleOverrideCableLength = (sectionId: string, length: number | null) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      if (length === null) {
        next.delete(sectionId);
      } else {
        next.set(sectionId, length);
      }
      return next;
    });
  };

  const derived = useMemo(() => deriveCableValues(params), [params]);
  const schedule = useMemo(() => computeCableSchedule(params, overrides), [params, overrides]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Input Panel */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <CableInputPanel
            params={params}
            derived={derived}
            onParamChange={handleParamChange}
          />
        </div>

        {/* Right: Results */}
        <div className="flex-1 space-y-6">
          <div className="flex justify-end">
            <CableExportButton
              targetRef={exportRef}
              summary={schedule}
              params={params}
            />
          </div>

          <div ref={exportRef} className="space-y-6">
            <Tabs defaultValue="layout" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="layout">Layout</TabsTrigger>
                <TabsTrigger value="schedule">Cable Schedule</TabsTrigger>
                <TabsTrigger value="vd">Voltage Drop</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
              </TabsList>

              <TabsContent value="layout" className="space-y-4 mt-4">
                <SectionLayout sections={schedule.sections} params={params} />
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4 mt-4">
                <CableScheduleTable
                  results={schedule.cableResults}
                  allowedVd_pct={params.allowedVoltageDrop_pct}
                  onOverrideCableLength={handleOverrideCableLength}
                />
              </TabsContent>

              <TabsContent value="vd" className="space-y-4 mt-4">
                <VoltageDropChart
                  results={schedule.cableResults}
                  allowedVd_pct={params.allowedVoltageDrop_pct}
                />
              </TabsContent>

              <TabsContent value="summary" className="space-y-4 mt-4">
                <CableSummary
                  summary={schedule}
                  allowedVd_pct={params.allowedVoltageDrop_pct}
                />
              </TabsContent>
            </Tabs>

            <CableDataSources />
          </div>
        </div>
      </div>
    </div>
  );
}
