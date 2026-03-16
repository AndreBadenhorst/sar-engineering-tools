import { useMemo } from 'react';
import { Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LogarithmicScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ScenarioResult } from '@/lib/monorail-engine';
import {
  SCENARIO_COLORS,
  STANDARD_FUSE_RATINGS,
  FUSE_COLORS,
  generateFuseCurveData,
} from '@/lib/monorail-engine';

ChartJS.register(LogarithmicScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface FuseTripChartProps {
  scenarios: ScenarioResult[];
  selectedFuseRating: number;
}

export function FuseTripChart({ scenarios, selectedFuseRating }: FuseTripChartProps) {
  const datasets = useMemo(() => {
    const ds: any[] = [];

    // Fuse curve — single 30A Class CC (Littelfuse KLKR030)
    STANDARD_FUSE_RATINGS.forEach((rating) => {
      const curveData = generateFuseCurveData(rating);
      ds.push({
        label: `CC ${rating}A (KLKR030)`,
        data: curveData,
        borderColor: FUSE_COLORS[rating] ?? '#3b82f6',
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
        tension: 0.4,
        showLine: true,
        order: 0,
      });
    });

    // Scenario markers
    const scenarioMeta = [
      { color: SCENARIO_COLORS[1].line, label: 'S1: Full Speed' },
      { color: SCENARIO_COLORS[2].line, label: 'S2: Pull-Off' },
    ];

    scenarios.forEach((s, i) => {
      const meta = scenarioMeta[i];
      ds.push({
        label: `${meta.label} (${s.peakCurrent.toFixed(1)}A / ${s.peakDuration.toFixed(1)}s)`,
        data: [{ x: s.peakCurrent, y: s.peakDuration }],
        borderColor: meta.color,
        backgroundColor: meta.color,
        pointRadius: 8,
        pointStyle: 'crossRot',
        pointBorderWidth: 3,
        showLine: false,
        order: -1,
      });
    });

    return ds;
  }, [scenarios, selectedFuseRating]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'nearest' as const },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#9ca3b8',
          font: { size: 10, family: 'Inter' },
          usePointStyle: true,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: '#1e2130',
        borderColor: '#2d3148',
        borderWidth: 1,
        titleColor: '#e8eaf0',
        bodyColor: '#9ca3b8',
        callbacks: {
          label: (item: any) => {
            const ds = item.dataset;
            if (ds.showLine === false) {
              return `${ds.label}`;
            }
            return `${ds.label}: ${item.parsed.x.toFixed(1)}A @ ${item.parsed.y.toFixed(2)}s`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'logarithmic' as const,
        title: { display: true, text: 'Current (A)', color: '#6b7294', font: { size: 12 } },
        ticks: {
          color: '#6b7294',
          font: { size: 10 },
          callback: (val: number | string) => {
            const v = Number(val);
            const logVal = Math.log10(v);
            if (Math.abs(logVal - Math.round(logVal)) < 0.01) return v + 'A';
            if ([20, 30, 50, 200, 300, 500].includes(v)) return v + 'A';
            return '';
          },
          maxTicksLimit: 10,
        },
        grid: { color: '#2d314830' },
        min: 10,
        max: 1000,
      },
      y: {
        type: 'logarithmic' as const,
        title: { display: true, text: 'Pre-Arcing Time (s)', color: '#6b7294', font: { size: 12 } },
        ticks: {
          color: '#6b7294',
          font: { size: 10 },
          callback: (val: number | string) => {
            const v = Number(val);
            const logVal = Math.log10(v);
            if (Math.abs(logVal - Math.round(logVal)) < 0.01) return v + 's';
            if ([0.03, 0.05, 0.3, 0.5, 3, 5, 30, 50, 300, 500, 3000, 5000].includes(v)) return v + 's';
            return '';
          },
        },
        grid: { color: '#2d314850' },
        min: 0.01,
        max: 10000,
      },
    },
  }), []);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Fuse Trip Curve</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <Scatter data={{ datasets }} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
