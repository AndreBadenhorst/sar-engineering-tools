import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Bar } from 'react-chartjs-2';
import type { CableSizeResult } from '@/lib/cable-engine';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, annotationPlugin);

interface VoltageDropChartProps {
  results: CableSizeResult[];
  allowedVd_pct: number;
}

export function VoltageDropChart({ results, allowedVd_pct }: VoltageDropChartProps) {
  const chartData = useMemo(() => ({
    labels: results.map((r) => r.sectionId),
    datasets: [
      {
        label: 'Voltage Drop (%)',
        data: results.map((r) => r.finalVoltageDrop_pct),
        backgroundColor: results.map((r) =>
          r.finalVoltageDrop_pct > allowedVd_pct
            ? 'rgba(239, 68, 68, 0.6)'
            : r.finalVoltageDrop_pct > allowedVd_pct * 0.8
            ? 'rgba(245, 158, 11, 0.6)'
            : 'rgba(45, 212, 191, 0.6)'
        ),
        borderColor: results.map((r) =>
          r.finalVoltageDrop_pct > allowedVd_pct
            ? '#ef4444'
            : r.finalVoltageDrop_pct > allowedVd_pct * 0.8
            ? '#f59e0b'
            : '#2dd4bf'
        ),
        borderWidth: 1,
        borderRadius: 3,
      },
    ],
  }), [results, allowedVd_pct]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e2130',
        titleColor: '#e8eaf0',
        bodyColor: '#9ca3b8',
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: {
          label: (ctx: any) => `ΔV: ${ctx.raw.toFixed(2)}% (limit: ${allowedVd_pct}%)`,
        },
      },
      annotation: {
        annotations: {
          limitLine: {
            type: 'line' as const,
            yMin: allowedVd_pct,
            yMax: allowedVd_pct,
            borderColor: '#ef4444',
            borderWidth: 2,
            borderDash: [6, 4],
            label: {
              display: true,
              content: `Limit: ${allowedVd_pct}%`,
              position: 'end' as const,
              backgroundColor: 'rgba(239, 68, 68, 0.8)',
              color: '#fff',
              font: { size: 10 },
            },
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#9ca3b8', font: { size: 10 } },
        grid: { display: false },
      },
      y: {
        title: { display: true, text: 'Voltage Drop (%)', color: '#9ca3b8' },
        ticks: { color: '#9ca3b8', font: { size: 10 } },
        grid: { color: '#2d314830' },
        beginAtZero: true,
        suggestedMax: Math.max(allowedVd_pct * 1.2, ...results.map((r) => r.finalVoltageDrop_pct * 1.1)),
      },
    },
  }), [results, allowedVd_pct]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Voltage Drop per Section</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <Bar data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
