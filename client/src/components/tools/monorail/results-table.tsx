import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ScenarioResult, DerivedValues } from '@/lib/monorail-engine';
import { getTripStatus, SCENARIO_COLORS } from '@/lib/monorail-engine';

interface ResultsTableProps {
  scenarios: ScenarioResult[];
  fuseRating: number;
  derived: DerivedValues;
  totalSystemCarriers: number;
}

export function ResultsTable({ scenarios, fuseRating, derived, totalSystemCarriers }: ResultsTableProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Results Summary</CardTitle>
          <div className="flex gap-4 text-xs font-mono">
            <span className="text-muted-foreground">
              Section: <span className="text-foreground font-medium">{derived.numCarriers} carriers</span>
              {' '}| System: <span className="text-foreground font-medium">{totalSystemCarriers} carriers</span>
              {' '}= <span className="text-foreground font-medium">{derived.totalSystemCurrent.toFixed(1)} A</span> running
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scenario</TableHead>
              <TableHead>Peak Section Current (A)</TableHead>
              <TableHead>Fuse (A)</TableHead>
              <TableHead>Projected Trip Time</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scenarios.map((s, i) => {
              const scenarioNum = i + 1;
              const color = SCENARIO_COLORS[scenarioNum as 1 | 2].line;
              const { status, tripTime, i2tResult } = getTripStatus(s, fuseRating);
              // Format trip time: show in minutes if > 60s, otherwise seconds
              let tripTimeStr: string;
              if (tripTime === Infinity) {
                tripTimeStr = '\u221E';
              } else if (tripTime >= 3600) {
                tripTimeStr = `${(tripTime / 3600).toFixed(1)} h`;
              } else if (tripTime >= 60) {
                tripTimeStr = `${(tripTime / 60).toFixed(1)} min`;
              } else {
                tripTimeStr = `${tripTime.toFixed(1)} s`;
              }
              // Add "~" prefix for projected (non-actual) trip times
              if (!i2tResult.trips && tripTime < Infinity) {
                tripTimeStr = `\u2248 ${tripTimeStr}`;
              }

              return (
                <TableRow key={scenarioNum}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      S{scenarioNum}: {s.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.peakCurrent.toFixed(1)}</TableCell>
                  <TableCell className="font-mono text-xs">{fuseRating}</TableCell>
                  <TableCell className="font-mono text-xs">{tripTimeStr}</TableCell>
                  <TableCell>
                    <Badge
                      variant={status === 'SAFE' ? 'default' : status === 'WARNING' ? 'secondary' : 'destructive'}
                      className={
                        status === 'SAFE'
                          ? 'bg-green-600/20 text-green-400 border-green-600/30'
                          : status === 'WARNING'
                            ? 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30'
                            : 'bg-red-600/20 text-red-400 border-red-600/30'
                      }
                    >
                      {status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
          Trip assessment uses Miner's cumulative damage rule (no cooling) against the Littelfuse KLKR030 Class CC 30A
          time-current curve. At each timestep, damage += dt / tripTime(I). Trip occurs when damage
          reaches 1.0. For periodic waveforms the projected trip time is extrapolated beyond the
          {' '}{scenarios[0]?.timeSteps?.length ? ((scenarios[0].timeSteps.length - 1) * (scenarios[0].timeSteps[1] - scenarios[0].timeSteps[0])).toFixed(0) : '120'}s
          simulation window. "\u2248" indicates an extrapolated value. Conservative (worst case, no cooling).
        </p>
      </CardContent>
    </Card>
  );
}
