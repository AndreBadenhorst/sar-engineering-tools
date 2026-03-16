import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { PowerSection, CableParams } from '@/lib/cable-engine';

interface SectionLayoutProps {
  sections: PowerSection[];
  params: CableParams;
}

export function SectionLayout({ sections, params }: SectionLayoutProps) {
  if (sections.length === 0) return null;

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = 140;
  const margin = { left: 40, right: 40, top: 30, bottom: 40 };
  const railY = 50;
  const railHeight = 20;

  // Compute total extent (rail + maintenance bays)
  const allSections = sections;
  const totalExtent = allSections.length > 0
    ? allSections[allSections.length - 1].endPosition_m
    : params.totalRailLength_m;

  const plotWidth = svgWidth - margin.left - margin.right;
  const scale = (pos: number) => margin.left + (pos / totalExtent) * plotWidth;

  const getColor = (type: string) => {
    switch (type) {
      case 'standard': return '#2dd4bf'; // teal
      case 'remainder': return '#f59e0b'; // amber
      case 'maintenance': return '#a78bfa'; // purple
      default: return '#6b7280';
    }
  };

  const dbX = scale(Math.min(params.db_positionAlongRail_m, totalExtent));
  const dbY = railY + railHeight + 35;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Section Layout</CardTitle>
      </CardHeader>
      <CardContent>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto"
          style={{ minHeight: '120px' }}
        >
          {/* Rail baseline */}
          <line
            x1={margin.left}
            y1={railY + railHeight / 2}
            x2={svgWidth - margin.right}
            y2={railY + railHeight / 2}
            stroke="#374151"
            strokeWidth={1}
            strokeDasharray="4 2"
          />

          {/* Sections */}
          {allSections.map((section) => {
            const x1 = scale(section.startPosition_m);
            const x2 = scale(section.endPosition_m);
            const w = Math.max(x2 - x1, 2);
            const color = getColor(section.type);
            const feedX = scale(section.feedPoint_m);

            return (
              <g key={section.id}>
                {/* Section rectangle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <rect
                      x={x1 + 1}
                      y={railY}
                      width={w - 2}
                      height={railHeight}
                      fill={color}
                      fillOpacity={0.3}
                      stroke={color}
                      strokeWidth={1.5}
                      rx={2}
                      className="cursor-pointer hover:fill-opacity-50 transition-all"
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <div className="space-y-0.5">
                      <div className="font-medium">{section.id}</div>
                      <div>{section.length_m.toFixed(1)}m ({section.type})</div>
                      <div>Feed: {section.feedPosition} ({section.feedPoint_m.toFixed(1)}m)</div>
                      {section.maxCarriersInSection > 0 && (
                        <div>{section.maxCarriersInSection} carriers max</div>
                      )}
                      <div>Design: {section.designCurrent_A.toFixed(1)}A</div>
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* Section label */}
                <text
                  x={(x1 + x2) / 2}
                  y={railY - 6}
                  textAnchor="middle"
                  className="text-[8px]"
                  fill="#9ca3af"
                >
                  {section.id}
                </text>

                {/* Feed point marker */}
                <circle
                  cx={feedX}
                  cy={railY + railHeight + 6}
                  r={3}
                  fill={color}
                />
                <line
                  x1={feedX}
                  y1={railY + railHeight}
                  x2={feedX}
                  y2={railY + railHeight + 6}
                  stroke={color}
                  strokeWidth={1}
                />
              </g>
            );
          })}

          {/* DB marker */}
          <rect
            x={dbX - 8}
            y={dbY - 6}
            width={16}
            height={12}
            fill="#3b82f6"
            fillOpacity={0.4}
            stroke="#3b82f6"
            strokeWidth={1.5}
            rx={2}
          />
          <text
            x={dbX}
            y={dbY + 16}
            textAnchor="middle"
            className="text-[8px] font-medium"
            fill="#60a5fa"
          >
            DB
          </text>

          {/* Scale markers */}
          <text x={margin.left} y={svgHeight - 5} className="text-[8px]" fill="#6b7280">0m</text>
          <text x={svgWidth - margin.right} y={svgHeight - 5} textAnchor="end" className="text-[8px]" fill="#6b7280">
            {totalExtent.toFixed(0)}m
          </text>

          {/* Legend */}
          <g transform={`translate(${margin.left}, ${svgHeight - 8})`}>
            {[
              { color: '#2dd4bf', label: 'Standard' },
              { color: '#f59e0b', label: 'Remainder' },
              { color: '#a78bfa', label: 'Maint. Bay' },
              { color: '#3b82f6', label: 'DB' },
            ].map((item, i) => (
              <g key={item.label} transform={`translate(${i * 90}, 0)`}>
                <rect x={0} y={-5} width={8} height={8} fill={item.color} fillOpacity={0.5} rx={1} />
                <text x={12} y={2} className="text-[7px]" fill="#9ca3af">{item.label}</text>
              </g>
            ))}
          </g>
        </svg>
      </CardContent>
    </Card>
  );
}
