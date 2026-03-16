import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { CableScheduleSummary } from '@/lib/cable-engine';

interface CableSummaryProps {
  summary: CableScheduleSummary;
  allowedVd_pct: number;
}

export function CableSummary({ summary, allowedVd_pct }: CableSummaryProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Cable BOM */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cable Bill of Materials</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Size (mm²)</TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead className="text-right">Total Length (m)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.cableTotals.map((t) => (
                <TableRow key={t.size_mm2}>
                  <TableCell className="font-mono text-sm font-medium">{t.size_mm2} mm²</TableCell>
                  <TableCell className="text-right font-mono text-sm">{t.count}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{t.totalLength_m.toFixed(1)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2">
                <TableCell className="font-medium">Total</TableCell>
                <TableCell className="text-right font-mono text-sm font-medium">
                  {summary.cableResults.length}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-medium">
                  {summary.totalCableLength_m.toFixed(1)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* System Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">System Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Power Sections</span>
              <span className="font-mono">{summary.totalSections}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Maintenance Bays</span>
              <span className="font-mono">{summary.totalMaintenanceBays}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Cable Runs</span>
              <span className="font-mono">{summary.cableResults.length}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-muted-foreground">Total Cable Length</span>
              <span className="font-mono font-medium">{summary.totalCableLength_m.toFixed(1)} m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Worst-Case VD</span>
              <div className="flex items-center gap-2">
                <span className={`font-mono ${
                  summary.maxVoltageDrop_pct > allowedVd_pct ? 'text-red-400' : 'text-green-400'
                }`}>
                  {summary.maxVoltageDrop_pct.toFixed(2)}%
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {summary.worstSection}
                </Badge>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VD Limit</span>
              <span className="font-mono">{allowedVd_pct}%</span>
            </div>
          </div>

          {/* Status */}
          <div className="pt-3 border-t">
            {summary.maxVoltageDrop_pct <= allowedVd_pct ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30">
                All sections within voltage drop limit
              </Badge>
            ) : (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30">
                {summary.cableResults.filter((r) => r.finalVoltageDrop_pct > allowedVd_pct).length} section(s) exceed voltage drop limit
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
