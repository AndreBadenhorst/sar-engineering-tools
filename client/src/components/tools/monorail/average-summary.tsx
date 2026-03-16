import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ScenarioResult } from '@/lib/monorail-engine';
import { SCENARIO_COLORS } from '@/lib/monorail-engine';

interface AverageSummaryProps {
  scenarios: ScenarioResult[];
  fuseRating: number;
}

export function AverageSummary({ scenarios, fuseRating }: AverageSummaryProps) {
  // UL 248-1 Table 4: conventional fusing current = 2.0× In
  // (0–30A fuses must clear within 4 min at 2×In)
  const convFusing = fuseRating * 2.0;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Average Current Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {scenarios.map((s, i) => {
            const scenarioNum = (i + 1) as 1 | 2;
            const color = SCENARIO_COLORS[scenarioNum].line;
            const avgColor = SCENARIO_COLORS[scenarioNum].avgLine;
            const pctOfFuse = (s.avgCurrent / fuseRating) * 100;
            const pctOfConv = (s.avgCurrent / convFusing) * 100;

            // Status based on average vs fuse thresholds
            let avgStatus: 'SAFE' | 'WARNING' | 'OVER';
            if (s.avgCurrent >= convFusing) {
              avgStatus = 'OVER';
            } else if (s.avgCurrent >= fuseRating) {
              avgStatus = 'WARNING';
            } else {
              avgStatus = 'SAFE';
            }

            return (
              <div
                key={scenarioNum}
                className="rounded-lg border border-border/50 p-4 space-y-3"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-medium">S{scenarioNum}: {s.name}</span>
                  </div>
                  <Badge
                    variant="default"
                    className={
                      avgStatus === 'SAFE'
                        ? 'bg-green-600/20 text-green-400 border-green-600/30'
                        : avgStatus === 'WARNING'
                          ? 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30'
                          : 'bg-red-600/20 text-red-400 border-red-600/30'
                    }
                  >
                    {avgStatus === 'OVER' ? 'OVER FUSE' : avgStatus}
                  </Badge>
                </div>

                {/* Average current value */}
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-bold" style={{ color: avgColor }}>
                    {s.avgCurrent.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground">A avg</span>
                </div>

                {/* Bar: avg vs fuse rating */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>vs Fuse Rating ({fuseRating}A)</span>
                    <span className="font-mono">{pctOfFuse.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(pctOfFuse, 100)}%`,
                        backgroundColor: pctOfFuse > 100 ? '#ef4444' : avgColor,
                      }}
                    />
                  </div>
                </div>

                {/* Bar: avg vs conv. fusing */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>vs Conv. Fusing 2×In ({convFusing.toFixed(0)}A)</span>
                    <span className="font-mono">{pctOfConv.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(pctOfConv, 100)}%`,
                        backgroundColor: pctOfConv > 100 ? '#ef4444' : avgColor,
                      }}
                    />
                  </div>
                </div>

                {/* Peak vs Average comparison */}
                <div className="flex gap-4 text-[10px] font-mono pt-1 border-t border-border/30">
                  <span className="text-muted-foreground">
                    Peak: <span className="text-foreground">{s.peakCurrent.toFixed(1)}A</span>
                  </span>
                  <span className="text-muted-foreground">
                    Crest: <span className="text-foreground">{s.peakCurrent > 0 ? (s.peakCurrent / s.avgCurrent).toFixed(2) : '—'}×</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
          Time-weighted average current across the 120s simulation window. Crest factor = peak / average.
          Average exceeding the fuse rating ({fuseRating}A) indicates sustained overload;
          exceeding conventional fusing current 2×In ({convFusing.toFixed(0)}A per UL 248-1) indicates certain trip.
        </p>
      </CardContent>
    </Card>
  );
}
