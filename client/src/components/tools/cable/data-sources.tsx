import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';
import { CABLE_DATA_SOURCES } from '@/lib/data/cable-data';

export function CableDataSources() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Engineering References</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {CABLE_DATA_SOURCES.map((source) => (
            <div key={source.title} className="space-y-1">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                {source.title}
                <ExternalLink className="h-3 w-3" />
              </a>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {source.description}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-4 pt-3 border-t">
          All cable sizing data must be verifiable from the source documents listed above.
          Ampacity and derating factors are per IEC 60364-5-52:2009. Conductor resistance
          values are per IEC 60228:2004 at operating temperature.
        </p>
      </CardContent>
    </Card>
  );
}
