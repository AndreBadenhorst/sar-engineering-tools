import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, RotateCcw } from 'lucide-react';
import type { CableSizeResult } from '@/lib/cable-engine';

interface CableScheduleTableProps {
  results: CableSizeResult[];
  allowedVd_pct: number;
  onOverrideCableLength: (sectionId: string, length: number | null) => void;
}

export function CableScheduleTable({ results, allowedVd_pct, onOverrideCableLength }: CableScheduleTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (sectionId: string, currentLength: number) => {
    setEditingId(sectionId);
    setEditValue(currentLength.toFixed(1));
  };

  const confirmEdit = (sectionId: string) => {
    const v = parseFloat(editValue);
    if (!isNaN(v) && v > 0) {
      onOverrideCableLength(sectionId, v);
    }
    setEditingId(null);
  };

  const resetOverride = (sectionId: string) => {
    onOverrideCableLength(sectionId, null);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'standard': return 'bg-primary/20 text-primary border-primary/30';
      case 'remainder': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'maintenance': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return '';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Cable Schedule</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Section</TableHead>
              <TableHead className="w-16 text-right">Rail (m)</TableHead>
              <TableHead className="w-28 text-right">Cable (m)</TableHead>
              <TableHead className="w-16 text-right">I (A)</TableHead>
              <TableHead className="w-16 text-right">Amp. (mm²)</TableHead>
              <TableHead className="w-16 text-right">VD (mm²)</TableHead>
              <TableHead className="w-16 text-right">Final (mm²)</TableHead>
              <TableHead className="w-20 text-right">ΔV (%)</TableHead>
              <TableHead className="w-20">Basis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r) => (
              <TableRow key={r.sectionId}>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${getTypeColor(r.sectionType)}`}>
                    {r.sectionId}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {r.sectionLength_m.toFixed(1)}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === r.sectionId ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmEdit(r.sectionId);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="h-6 w-16 text-xs font-mono"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => confirmEdit(r.sectionId)}>
                        ✓
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <span className={`font-mono text-xs ${r.isOverridden ? 'text-amber-400' : ''}`}>
                        {r.effectiveCableLength_m.toFixed(1)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 opacity-40 hover:opacity-100"
                        onClick={() => startEdit(r.sectionId, r.effectiveCableLength_m)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {r.isOverridden && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 opacity-40 hover:opacity-100 text-amber-400"
                          onClick={() => resetOverride(r.sectionId)}
                          title={`Reset to calculated: ${r.calculatedCableLength_m.toFixed(1)}m`}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {r.designCurrent_A.toFixed(1)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {r.ampacitySize_mm2}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {r.vdSize_mm2}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-medium">
                  {r.finalSize_mm2}
                </TableCell>
                <TableCell className="text-right">
                  <span className={`font-mono text-xs ${
                    r.finalVoltageDrop_pct > allowedVd_pct
                      ? 'text-red-400'
                      : r.finalVoltageDrop_pct > allowedVd_pct * 0.8
                      ? 'text-amber-400'
                      : 'text-green-400'
                  }`}>
                    {r.finalVoltageDrop_pct.toFixed(2)}%
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      r.sizingBasis === 'voltage-drop'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-green-500/20 text-green-400 border-green-500/30'
                    }`}
                  >
                    {r.sizingBasis === 'voltage-drop' ? 'V.Drop' : 'Ampacity'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-[10px] text-muted-foreground mt-3">
          Cable sized per IEC 60364-5-52. Click the pencil icon to override calculated cable lengths.
          Amber values indicate manual overrides.
        </p>
      </CardContent>
    </Card>
  );
}
