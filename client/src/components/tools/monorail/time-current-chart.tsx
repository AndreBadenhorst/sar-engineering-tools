import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ScenarioResult } from '@/lib/monorail-engine';
import { SCENARIO_COLORS } from '@/lib/monorail-engine';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface TimeCurrentChartProps {
  scenarios: ScenarioResult[];
  fuseRating: number;
}

export function TimeCurrentChart({ scenarios, fuseRating }: TimeCurrentChartProps) {
  const [s1, s2] = scenarios;

  const chartData = useMemo(() => ({
    labels: s1.timeSteps,
    datasets: [
      {
        label: 'S1: Full Speed Flow',
        data: s1.currents,
        borderColor: SCENARIO_COLORS[1].line,
        backgroundColor: SCENARIO_COLORS[1].bg,
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0.1,
      },
      {
        label: `S1 Avg (${s1.avgCurrent.toFixed(1)}A)`,
        data: s1.runningAvg,
        borderColor: SCENARIO_COLORS[1].avgLine,
        borderWidth: 2,
        borderDash: [8, 4],
        pointRadius: 0,
        fill: false,
        tension: 0.3,
      },
      {
        label: 'S2: Sequential Pull-Off',
        data: s2.currents,
        borderColor: SCENARIO_COLORS[2].line,
        backgroundColor: SCENARIO_COLORS[2].bg,
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0.1,
      },
      {
        label: `S2 Avg (${s2.avgCurrent.toFixed(1)}A)`,
        data: s2.runningAvg,
        borderColor: SCENARIO_COLORS[2].avgLine,
        borderWidth: 2,
        borderDash: [8, 4],
        pointRadius: 0,
        fill: false,
        tension: 0.3,
      },
      {
        label: `Fuse Rating (${fuseRating}A)`,
        data: s1.timeSteps.map(() => fuseRating),
        borderColor: '#ef4444',
        borderWidth: 1.5,
        borderDash: [8, 4],
        pointRadius: 0,
        fill: false,
      },
      {
        label: `Conv. Fusing (${(fuseRating * 1.6).toFixed(0)}A)`,
        data: s1.timeSteps.map(() => fuseRating * 1.6),
        borderColor: '#ef444480',
        borderWidth: 1,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
      },
    ],
  }), [s1, s2, fuseRating]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#9ca3b8',
          font: { size: 11, family: 'Inter' },
          usePointStyle: true,
          pointStyle: 'line' as const,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: '#1e2130',
        borderColor: '#2d3148',
        borderWidth: 1,
        titleColor: '#e8eaf0',
        bodyColor: '#9ca3b8',
        titleFont: { family: 'Inter', size: 12 },
        bodyFont: { family: 'JetBrains Mono', size: 11 },
        callbacks: {
          title: (items: any[]) => `t = ${items[0].label} s`,
          label: (item: any) => `${item.dataset.label}: ${Number(item.raw).toFixed(1)} A`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Time (s)', color: '#6b7294', font: { size: 12 } },
        ticks: { color: '#6b7294', font: { size: 10 }, maxTicksLimit: 20 },
        grid: { color: '#2d314830' },
      },
      y: {
        title: { display: true, text: 'Current (A)', color: '#6b7294', font: { size: 12 } },
        ticks: { color: '#6b7294', font: { size: 10 } },
        grid: { color: '#2d314850' },
        beginAtZero: true,
      },
    },
  }), []);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Time-Current Simulation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <Line data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
