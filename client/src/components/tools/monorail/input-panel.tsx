import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { INRUSH_MULTIPLIER } from '@/lib/data/drive-curves';
import type { MonorailParams, DerivedValues } from '@/lib/monorail-engine';

interface InputPanelProps {
  params: MonorailParams;
  derived: DerivedValues;
  onParamChange: (key: keyof MonorailParams, value: number) => void;
}

export function InputPanel({ params, derived, onParamChange }: InputPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Input Parameters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Supply Voltage */}
        <div className="space-y-1.5">
          <Label htmlFor="voltage">Supply Voltage (V)</Label>
          <Select
            value={String(params.voltage)}
            onValueChange={(v) => onParamChange('voltage', Number(v))}
          >
            <SelectTrigger id="voltage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="400">400 V</SelectItem>
              <SelectItem value="480">480 V</SelectItem>
              <SelectItem value="690">690 V</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Carrier Power */}
        <div className="space-y-1.5">
          <Label htmlFor="power">Carrier Power (kW)</Label>
          <Input
            id="power"
            type="number"
            step="0.1"
            min="0.1"
            value={params.power_kW}
            onChange={(e) => onParamChange('power_kW', parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* Carrier Length */}
        <div className="space-y-1.5">
          <Label htmlFor="carrierLength">Carrier Length (mm)</Label>
          <Input
            id="carrierLength"
            type="number"
            step="1"
            min="100"
            value={params.carrierLength_mm}
            onChange={(e) => onParamChange('carrierLength_mm', parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* Brush Offset from Front Bumper */}
        <div className="space-y-1.5">
          <Label htmlFor="brushOffset">Brush Offset from Front (mm)</Label>
          <Input
            id="brushOffset"
            type="number"
            step="10"
            min="0"
            max={params.carrierLength_mm}
            value={params.brushOffset_mm}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= 0 && v <= params.carrierLength_mm) {
                onParamChange('brushOffset_mm', v);
              }
            }}
          />
          <p className="text-[10px] text-muted-foreground leading-tight">
            Distance from front bumper to the Vahle SA-KDS2/40 current collector.
            Default: carrier length &minus; 500 mm (brush 500 mm from back).
          </p>
        </div>

        {/* Gap Between Carriers */}
        <div className="space-y-1.5">
          <Label htmlFor="gap">Gap Between Carriers (mm)</Label>
          <Input
            id="gap"
            type="number"
            step="10"
            min="0"
            value={params.gap_mm}
            onChange={(e) => onParamChange('gap_mm', parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* Carrier Speed */}
        <div className="space-y-1.5">
          <Label htmlFor="speed">Carrier Speed (m/s)</Label>
          <Input
            id="speed"
            type="number"
            step="0.1"
            min="0.1"
            value={params.speed_ms}
            onChange={(e) => onParamChange('speed_ms', parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* Acceleration Time */}
        <div className="space-y-1.5">
          <Label htmlFor="accelTime">Acceleration Time (s)</Label>
          <Input
            id="accelTime"
            type="number"
            step="0.5"
            min="0.5"
            value={params.accelTime_s}
            onChange={(e) => onParamChange('accelTime_s', parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* Power Factor */}
        <div className="space-y-1.5">
          <Label htmlFor="pf">Power Factor</Label>
          <Input
            id="pf"
            type="number"
            step="0.01"
            min="0.5"
            max="1"
            value={params.powerFactor}
            onChange={(e) => onParamChange('powerFactor', parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* Rail Section Length */}
        <div className="space-y-1.5">
          <Label htmlFor="railLength">Rail Section Length (m)</Label>
          <Input
            id="railLength"
            type="number"
            step="1"
            min="1"
            value={params.railLength_m}
            onChange={(e) => onParamChange('railLength_m', parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* Total System Carriers */}
        <div className="space-y-1.5">
          <Label htmlFor="totalSystemCarriers">Total System Carriers</Label>
          <Input
            id="totalSystemCarriers"
            type="number"
            step="1"
            min="1"
            value={params.totalSystemCarriers}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1) onParamChange('totalSystemCarriers', v);
            }}
          />
          <p className="text-[10px] text-muted-foreground leading-tight">
            Total carriers across all power sections on the full monorail system.
          </p>
        </div>

        {/* Fuse Rating */}
        <div className="space-y-1.5">
          <Label htmlFor="fuseRating">Fuse Rating (A)</Label>
          <Select
            value={String(params.fuseRating_A)}
            onValueChange={(v) => onParamChange('fuseRating_A', Number(v))}
          >
            <SelectTrigger id="fuseRating">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 A — Class CC (KLKR030)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Derived Values */}
        <div className="mt-6 pt-4 border-t space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Derived Values</h4>
          <div className="grid gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pitch</span>
              <span className="font-mono text-xs">{derived.pitch_mm.toFixed(0)} mm ({derived.pitch_m.toFixed(3)} m)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Carriers in Section</span>
              <span className="font-mono text-xs">{derived.numCarriers} carriers</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Per-Carrier Current</span>
              <span className="font-mono text-xs">{derived.runningCurrent.toFixed(2)} A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Peak (Inrush)</span>
              <span className="font-mono text-xs">{derived.peakCurrent.toFixed(2)} A ({INRUSH_MULTIPLIER}x)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Brush Offset</span>
              <span className="font-mono text-xs">{derived.brushOffset_m.toFixed(3)} m from front</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-muted-foreground font-medium">System Current</span>
              <span className="font-mono text-xs font-medium">{derived.totalSystemCurrent.toFixed(1)} A</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
