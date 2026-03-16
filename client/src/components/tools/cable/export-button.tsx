import { useState, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, Copy, Loader2, Check, FileSpreadsheet } from 'lucide-react';
import type { CableScheduleSummary } from '@/lib/cable-engine';
import { generateCableScheduleCSV } from '@/lib/cable-engine';

interface ExportButtonProps {
  targetRef: RefObject<HTMLDivElement | null>;
  summary: CableScheduleSummary | null;
  params: { totalRailLength_m: number; sectionLength_m: number };
}

type ExportState = 'idle' | 'capturing' | 'copied' | 'downloaded';

export function CableExportButton({ targetRef, summary, params }: ExportButtonProps) {
  const [state, setState] = useState<ExportState>('idle');

  async function captureCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
    const html2canvas = (await import('html2canvas')).default;
    const originalOverflow = el.style.overflow;
    const originalHeight = el.style.height;
    el.style.overflow = 'visible';
    el.style.height = 'auto';
    const canvas = await html2canvas(el, {
      backgroundColor: '#0d0f17',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    el.style.overflow = originalOverflow;
    el.style.height = originalHeight;
    return canvas;
  }

  async function handleCopy() {
    if (!targetRef.current) return;
    setState('capturing');
    try {
      const canvas = await captureCanvas(targetRef.current);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setState('copied');
        } catch {
          // Fallback to download
          handleDownloadBlob(blob);
          setState('downloaded');
        }
        setTimeout(() => setState('idle'), 2000);
      });
    } catch {
      setState('idle');
    }
  }

  async function handleDownloadPNG() {
    if (!targetRef.current) return;
    setState('capturing');
    try {
      const canvas = await captureCanvas(targetRef.current);
      canvas.toBlob((blob) => {
        if (!blob) return;
        handleDownloadBlob(blob);
        setState('downloaded');
        setTimeout(() => setState('idle'), 2000);
      });
    } catch {
      setState('idle');
    }
  }

  function handleDownloadBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cable-schedule-${params.totalRailLength_m}m-${params.sectionLength_m}m.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadCSV() {
    if (!summary) return;
    const csv = generateCableScheduleCSV(summary);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cable-schedule-${params.totalRailLength_m}m-${params.sectionLength_m}m.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setState('downloaded');
    setTimeout(() => setState('idle'), 2000);
  }

  const icon =
    state === 'capturing' ? <Loader2 className="h-4 w-4 animate-spin" /> :
    state === 'copied' || state === 'downloaded' ? <Check className="h-4 w-4" /> :
    <Download className="h-4 w-4" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={state === 'capturing'}>
          {icon}
          <span className="ml-2">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopy}>
          <Copy className="h-4 w-4 mr-2" />
          Copy as PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadPNG}>
          <Download className="h-4 w-4 mr-2" />
          Download PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Download CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
