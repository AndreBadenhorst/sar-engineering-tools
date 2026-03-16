import { useState, type RefObject } from 'react';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Camera, Copy, Download, Check, Loader2 } from 'lucide-react';
import type { MonorailParams, DerivedValues } from '@/lib/monorail-engine';

interface ExportButtonProps {
  targetRef: RefObject<HTMLDivElement | null>;
  params: MonorailParams;
  derived: DerivedValues;
}

async function captureCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  // Show the export header (hidden by default via CSS)
  const exportHeader = el.querySelector('[data-export-header]') as HTMLElement | null;
  if (exportHeader) {
    exportHeader.classList.remove('hidden');
  }

  // Temporarily expand the element to its full scrollable size so html2canvas
  // captures everything, then restore.
  const origOverflow = el.style.overflow;
  const origHeight = el.style.height;
  el.style.overflow = 'visible';
  el.style.height = 'auto';

  const canvas = await html2canvas(el, {
    backgroundColor: '#111827', // match dark bg
    scale: 2, // retina quality
    useCORS: true,
    logging: false,
    // Capture the full scrollable area
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });

  el.style.overflow = origOverflow;
  el.style.height = origHeight;

  // Re-hide the export header
  if (exportHeader) {
    exportHeader.classList.add('hidden');
  }

  return canvas;
}

export function ExportButton({ targetRef, params, derived }: ExportButtonProps) {
  const [status, setStatus] = useState<'idle' | 'capturing' | 'copied' | 'downloaded'>('idle');

  const handleCopyToClipboard = async () => {
    if (!targetRef.current) return;
    setStatus('capturing');
    try {
      const canvas = await captureCanvas(targetRef.current);
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setStatus('idle');
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setStatus('copied');
          setTimeout(() => setStatus('idle'), 2000);
        } catch {
          // Clipboard API may fail in iframes — fall back to download
          downloadBlob(blob, buildFilename(params));
          setStatus('downloaded');
          setTimeout(() => setStatus('idle'), 2000);
        }
      }, 'image/png');
    } catch {
      setStatus('idle');
    }
  };

  const handleDownload = async () => {
    if (!targetRef.current) return;
    setStatus('capturing');
    try {
      const canvas = await captureCanvas(targetRef.current);
      canvas.toBlob((blob) => {
        if (!blob) {
          setStatus('idle');
          return;
        }
        downloadBlob(blob, buildFilename(params));
        setStatus('downloaded');
        setTimeout(() => setStatus('idle'), 2000);
      }, 'image/png');
    } catch {
      setStatus('idle');
    }
  };

  const icon =
    status === 'capturing' ? <Loader2 className="h-4 w-4 animate-spin" /> :
    status === 'copied' ? <Check className="h-4 w-4 text-green-400" /> :
    status === 'downloaded' ? <Check className="h-4 w-4 text-green-400" /> :
    <Camera className="h-4 w-4" />;

  const label =
    status === 'capturing' ? 'Capturing…' :
    status === 'copied' ? 'Copied to clipboard' :
    status === 'downloaded' ? 'Downloaded' :
    'Export Image';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={status === 'capturing'}
          data-testid="export-image-button"
          className="gap-2"
        >
          {icon}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={handleCopyToClipboard}
          data-testid="export-copy-clipboard"
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy to Clipboard (paste into Excel)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDownload}
          data-testid="export-download-png"
        >
          <Download className="h-4 w-4 mr-2" />
          Download PNG
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function buildFilename(params: MonorailParams): string {
  const rail = params.railLength_m;
  const fuse = params.fuseRating_A;
  return `railcut-${rail}m-${fuse}A.png`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
