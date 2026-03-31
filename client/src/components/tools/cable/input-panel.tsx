import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { CableParams, MaintenanceBay, CableDerivedValues, FeedPosition } from '@/lib/cable-engine';
import { INSTALLATION_METHOD_LABELS, type InstallationMethod } from '@/lib/data/cable-data';

interface CableInputPanelProps {
  params: CableParams;
  derived: CableDerivedValues;
  onParamChange: <K extends keyof CableParams>(key: K, value: CableParams[K]) => void;
}

function CollapsibleSection({ title, defaultOpen = true, children }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        {title}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CableInputPanel({ params, derived, onParamChange }: CableInputPanelProps) {
  const handleNumericChange = (key: keyof CableParams, value: string, min?: number) => {
    const v = parseFloat(value);
    if (!isNaN(v) && (min === undefined || v >= min)) {
      onParamChange(key, v as any);
    }
  };

  const addMaintenanceBay = () => {
    const newId = `MB-${String(params.maintenanceBays.length + 1).padStart(2, '0')}`;
    const newBay: MaintenanceBay = { id: newId, length_m: 10, feedPosition: 'mid' };
    onParamChange('maintenanceBays', [...params.maintenanceBays, newBay]);
  };

  const removeMaintenanceBay = (index: number) => {
    const updated = params.maintenanceBays.filter((_, i) => i !== index);
    // Re-number IDs
    const renumbered = updated.map((bay, i) => ({
      ...bay,
      id: `MB-${String(i + 1).padStart(2, '0')}`,
    }));
    onParamChange('maintenanceBays', renumbered);
  };

  const updateMaintenanceBay = (index: number, field: keyof MaintenanceBay, value: any) => {
    const updated = [...params.maintenanceBays];
    updated[index] = { ...updated[index], [field]: value };
    onParamChange('maintenanceBays', updated);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Input Parameters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">

        {/* ── Rail Geometry ── */}
        <CollapsibleSection title="Rail Geometry" defaultOpen={true}>
          <div className="space-y-1.5">
            <Label htmlFor="totalRail">Total Rail Length (m)</Label>
            <Input
              id="totalRail"
              type="number"
              step="1"
              min="1"
              value={params.totalRailLength_m}
              onChange={(e) => handleNumericChange('totalRailLength_m', e.target.value, 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sectionLength">Power Section Length (m)</Label>
            <Input
              id="sectionLength"
              type="number"
              step="1"
              min="1"
              value={params.sectionLength_m}
              onChange={(e) => handleNumericChange('sectionLength_m', e.target.value, 1)}
            />
          </div>
          <div className="text-xs text-muted-foreground space-y-1 pt-1">
            <div className="flex justify-between">
              <span>Standard sections</span>
              <span className="font-mono">{derived.numStandardSections}</span>
            </div>
            {derived.hasRemainder && (
              <div className="flex justify-between">
                <span>Remainder</span>
                <span className="font-mono">{derived.remainderLength_m.toFixed(1)} m</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Total sections</span>
              <span className="font-mono">{derived.totalSections}</span>
            </div>
          </div>
        </CollapsibleSection>

        {/* ── Maintenance Bays ── */}
        <CollapsibleSection title="Maintenance Bays" defaultOpen={false}>
          {params.maintenanceBays.map((bay, i) => (
            <div key={bay.id} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">{bay.id}</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={bay.length_m}
                  onChange={(e) => updateMaintenanceBay(i, 'length_m', parseFloat(e.target.value) || 1)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="w-20">
                <Select
                  value={bay.feedPosition}
                  onValueChange={(v) => updateMaintenanceBay(i, 'feedPosition', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start">Start</SelectItem>
                    <SelectItem value="mid">Mid</SelectItem>
                    <SelectItem value="end">End</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => removeMaintenanceBay(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={addMaintenanceBay}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Maintenance Bay
          </Button>
        </CollapsibleSection>

        {/* ── Distribution Board ── */}
        <CollapsibleSection title="Distribution Board" defaultOpen={true}>
          <div className="space-y-1.5">
            <Label htmlFor="dbPerp">Perpendicular Distance (m)</Label>
            <Input
              id="dbPerp"
              type="number"
              step="0.5"
              min="0"
              value={params.db_perpDistance_m}
              onChange={(e) => handleNumericChange('db_perpDistance_m', e.target.value, 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dbPos">Position Along Rail (m)</Label>
            <Input
              id="dbPos"
              type="number"
              step="1"
              min="0"
              value={params.db_positionAlongRail_m}
              onChange={(e) => handleNumericChange('db_positionAlongRail_m', e.target.value, 0)}
            />
            <p className="text-[10px] text-muted-foreground">
              Distance from rail start (0) to the DB position along the rail axis.
            </p>
          </div>
        </CollapsibleSection>

        {/* ── Cable Route ── */}
        <CollapsibleSection title="Cable Route" defaultOpen={false}>
          <div className="space-y-1.5">
            <Label htmlFor="vDrop">Vertical Drop (m)</Label>
            <Input
              id="vDrop"
              type="number"
              step="0.5"
              min="0"
              value={params.verticalDrop_m}
              onChange={(e) => handleNumericChange('verticalDrop_m', e.target.value, 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="serviceLoop">Service Loop Allowance (m)</Label>
            <Input
              id="serviceLoop"
              type="number"
              step="0.5"
              min="0"
              value={params.serviceLoopAllowance_m}
              onChange={(e) => handleNumericChange('serviceLoopAllowance_m', e.target.value, 0)}
            />
            <p className="text-[10px] text-muted-foreground">
              Extra cable for termination at each end. Default 3.0 m (1.5 m × 2).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bendAdder">Bend / Route Adder (m)</Label>
            <Input
              id="bendAdder"
              type="number"
              step="0.5"
              min="0"
              value={params.bendAdder_m}
              onChange={(e) => handleNumericChange('bendAdder_m', e.target.value, 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default Feed Position</Label>
            <Select
              value={params.defaultFeedPosition}
              onValueChange={(v) => onParamChange('defaultFeedPosition', v as FeedPosition)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="start">Start of section</SelectItem>
                <SelectItem value="mid">Midpoint</SelectItem>
                <SelectItem value="end">End of section</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CollapsibleSection>

        {/* ── Installation ── */}
        <CollapsibleSection title="Cable Installation" defaultOpen={false}>
          <div className="space-y-1.5">
            <Label>Installation Method (IEC)</Label>
            <Select
              value={params.installationMethod}
              onValueChange={(v) => onParamChange('installationMethod', v as InstallationMethod)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(INSTALLATION_METHOD_LABELS) as [InstallationMethod, string][]).map(
                  ([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ambientTemp">Ambient Temperature (°C)</Label>
            <Input
              id="ambientTemp"
              type="number"
              step="5"
              min="10"
              max="60"
              value={params.ambientTemp_C}
              onChange={(e) => handleNumericChange('ambientTemp_C', e.target.value, 10)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="groupedCircuits">Grouped Circuits</Label>
            <Input
              id="groupedCircuits"
              type="number"
              step="1"
              min="1"
              value={params.groupedCircuits}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1) onParamChange('groupedCircuits', v);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Conductor Type</Label>
            <Select
              value={params.cableType}
              onValueChange={(v) => onParamChange('cableType', v as 'cu' | 'al')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cu">Copper (Cu)</SelectItem>
                <SelectItem value="al">Aluminium (Al)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Insulation Type</Label>
            <Select
              value={params.insulationType}
              onValueChange={(v) => onParamChange('insulationType', v as 'pvc' | 'xlpe')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pvc">PVC (70°C rated)</SelectItem>
                <SelectItem value="xlpe">XLPE (90°C rated)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground space-y-1 pt-1">
            <div className="flex justify-between">
              <span>Temp. derating</span>
              <span className="font-mono">{derived.tempDeratingFactor.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span>Group derating</span>
              <span className="font-mono">{derived.groupDeratingFactor.toFixed(3)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Combined factor</span>
              <span className="font-mono">{derived.combinedDeratingFactor.toFixed(3)}</span>
            </div>
          </div>
        </CollapsibleSection>

        {/* ── Electrical ── */}
        <CollapsibleSection title="Electrical" defaultOpen={true}>
          <div className="space-y-1.5">
            <Label>Supply Voltage (V)</Label>
            <Select
              value={String(params.voltage)}
              onValueChange={(v) => onParamChange('voltage', Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="400">400 V</SelectItem>
                <SelectItem value="480">480 V</SelectItem>
                <SelectItem value="690">690 V</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf">Power Factor</Label>
            <Input
              id="pf"
              type="number"
              step="0.01"
              min="0.5"
              max="1"
              value={params.powerFactor}
              onChange={(e) => handleNumericChange('powerFactor', e.target.value, 0.5)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="allowedVd">Allowed Voltage Drop (%)</Label>
            <Input
              id="allowedVd"
              type="number"
              step="0.5"
              min="0.5"
              max="10"
              value={params.allowedVoltageDrop_pct}
              onChange={(e) => handleNumericChange('allowedVoltageDrop_pct', e.target.value, 0.5)}
            />
          </div>

          {/* Current Source Toggle */}
          <div className="space-y-1.5">
            <Label>Design Current Source</Label>
            <Select
              value={params.currentSource}
              onValueChange={(v) => onParamChange('currentSource', v as 'manual' | 'from-railcut')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="from-railcut">From Railcut Simulation</SelectItem>
                <SelectItem value="manual">Manual Entry</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {params.currentSource === 'manual' ? (
            <div className="space-y-1.5">
              <Label htmlFor="manualCurrent">Design Current (A)</Label>
              <Input
                id="manualCurrent"
                type="number"
                step="1"
                min="1"
                value={params.manualDesignCurrent_A}
                onChange={(e) => handleNumericChange('manualDesignCurrent_A', e.target.value, 1)}
              />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="carrierPower">Carrier Power (kW)</Label>
                <Input
                  id="carrierPower"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={params.carrierPower_kW}
                  onChange={(e) => handleNumericChange('carrierPower_kW', e.target.value, 0.1)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="carrierLen">Carrier Length (mm)</Label>
                <Input
                  id="carrierLen"
                  type="number"
                  step="1"
                  min="100"
                  value={params.carrierLength_mm}
                  onChange={(e) => handleNumericChange('carrierLength_mm', e.target.value, 100)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="carrierGap">Gap Between Carriers (mm)</Label>
                <Input
                  id="carrierGap"
                  type="number"
                  step="10"
                  min="0"
                  value={params.gap_mm}
                  onChange={(e) => handleNumericChange('gap_mm', e.target.value, 0)}
                />
              </div>
            </>
          )}
        </CollapsibleSection>

        {/* ── Derived Values ── */}
        <div className="pt-4 border-t space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Derived Values</h4>
          <div className="grid gap-1.5 text-sm">
            {params.currentSource === 'from-railcut' && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pitch</span>
                  <span className="font-mono text-xs">{(derived.pitch_m * 1000).toFixed(0)} mm ({derived.pitch_m.toFixed(3)} m)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Per-Carrier Current</span>
                  <span className="font-mono text-xs">{derived.runningCurrent_A.toFixed(2)} A</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Carriers/Section</span>
                  <span className="font-mono text-xs">{derived.maxCarriersPerStdSection}</span>
                </div>
              </>
            )}
            <div className="flex justify-between pt-1 border-t">
              <span className="text-muted-foreground font-medium">Design Current/Section</span>
              <span className="font-mono text-xs font-medium">{derived.designCurrentPerStdSection_A.toFixed(1)} A</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
