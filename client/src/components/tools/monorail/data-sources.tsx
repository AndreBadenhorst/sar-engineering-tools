import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FUSE_DATA_SOURCES } from '@/lib/data/fuse-data';
import { DRIVE_DATA_SOURCES } from '@/lib/data/drive-curves';
import { BookOpen, ExternalLink } from 'lucide-react';

type SourceItem = string | { text: string; url: string | null };

interface DataSourceGroup {
  title: string;
  items: SourceItem[];
}

const BRUSH_SOURCES: DataSourceGroup[] = [
  {
    title: 'Current Collector (Brush) Model',
    items: [
      { text: 'Vahle SA-KDS2/40 current collector — mounted on ROFA PPC 1000 carrier', url: null },
      'The brush (current collector) picks up power from the conductor rail. Its position determines which power section supplies the carrier.',
      'Brush offset is measured from the front bumper of the carrier in the direction of travel.',
      'Default position: carrier length − 500 mm from front (i.e. 500 mm from the back of the carrier).',
      'A carrier straddles a section boundary when its body is in one section but its brush is already in the next — only the section containing the brush supplies power.',
      'In the animation, carriers whose brush is outside the section are dimmed and show 0 A. The yellow triangle indicates the brush position.',
    ],
  },
];

const SCENARIO_2_SOURCES: DataSourceGroup[] = [
  {
    title: 'Scenario 2 Physics — Sequential Pull-Off',
    items: [
      'Carriers are initially parked at pitch spacing (carrier i at position i × pitch from section start)',
      'The carrier closest to the EXIT departs first at t=0. Each subsequent carrier behind it follows 1 s later (exit-first pull-off)',
      'All carriers share the same acceleration profile: linear ramp to full speed, then constant velocity',
      'Position model: absolute_pos = parked_position + distance_travelled(t − start_time)',
      'Distance during acceleration: s = ½ a t²; after acceleration: s = s_accel + v × (t − t_accel)',
      'Current during acceleration: peak (1.6× running, per SEW Movimot 160% current limit); ramp-down to running current over the same duration as acceleration',
      'Carrier exits section when its brush position > rail_section_length',
    ],
  },
];

const allSources: DataSourceGroup[] = [
  ...FUSE_DATA_SOURCES,
  ...DRIVE_DATA_SOURCES,
  ...BRUSH_SOURCES,
  ...SCENARIO_2_SOURCES,
];

function renderItem(item: SourceItem) {
  if (typeof item === 'string') {
    return item;
  }
  if (item.url) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground underline decoration-dotted underline-offset-2"
      >
        {item.text}
        <ExternalLink className="inline h-3 w-3 ml-1" />
      </a>
    );
  }
  return item.text;
}

export function DataSources() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <BookOpen className="h-4 w-4" />
        Data Sources & References
      </h3>
      <div className="grid gap-4 md:grid-cols-3">
        {allSources.map((source, idx) => (
          <Card key={idx}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{source.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {source.items.map((item, i) => (
                  <li key={i} className="leading-relaxed">
                    &bull; {renderItem(item)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
