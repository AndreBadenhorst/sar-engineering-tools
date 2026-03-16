import { useRef, useCallback, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { SIM_DURATION, drawRailAnimation } from '@/lib/monorail-engine';
import type { MonorailParams, DerivedValues } from '@/lib/monorail-engine';

interface RailAnimationProps {
  params: MonorailParams;
  derived: DerivedValues;
}

export function RailAnimation({ params, derived }: RailAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(1); // default to scenario 2
  const [speed, setSpeed] = useState(5);
  const [displayTime, setDisplayTime] = useState(0);
  const [displayCurrent, setDisplayCurrent] = useState(0);
  const [displayCarriers, setDisplayCarriers] = useState(0);

  const draw = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { totalCurrent, carrierCount } = drawRailAnimation(canvas, t, scenarioIndex, params, derived);
    setDisplayTime(t);
    setDisplayCurrent(totalCurrent);
    setDisplayCarriers(carrierCount);
  }, [scenarioIndex, params, derived]);

  const animationLoop = useCallback((timestamp: number) => {
    if (lastTimestampRef.current === null) {
      lastTimestampRef.current = timestamp;
    }

    const delta = ((timestamp - lastTimestampRef.current) / 1000) * speed;
    lastTimestampRef.current = timestamp;
    timeRef.current += delta;

    if (timeRef.current > SIM_DURATION) {
      timeRef.current = SIM_DURATION;
      setPlaying(false);
      draw(timeRef.current);
      return;
    }

    draw(timeRef.current);
    animRef.current = requestAnimationFrame(animationLoop);
  }, [speed, draw]);

  useEffect(() => {
    if (playing) {
      lastTimestampRef.current = null;
      animRef.current = requestAnimationFrame(animationLoop);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [playing, animationLoop]);

  // Draw initial frame and redraw on param changes
  useEffect(() => {
    draw(timeRef.current);
  }, [draw]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      draw(timeRef.current);
    });
    observer.observe(canvas.parentElement!);
    return () => observer.disconnect();
  }, [draw]);

  const handlePlay = () => {
    if (timeRef.current >= SIM_DURATION) {
      timeRef.current = 0;
    }
    setPlaying(true);
  };

  const handlePause = () => setPlaying(false);

  const handleReset = () => {
    setPlaying(false);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    timeRef.current = 0;
    lastTimestampRef.current = null;
    draw(0);
  };

  const handleScenarioChange = (value: string) => {
    setScenarioIndex(Number(value));
    timeRef.current = 0;
    setPlaying(false);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    // Will be redrawn by the draw effect
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Rail Section Animation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              onClick={handlePlay}
              disabled={playing}
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={handlePause}
              disabled={!playing}
            >
              <Pause className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Scenario:</span>
            <Select value={String(scenarioIndex)} onValueChange={handleScenarioChange}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">1: Full Speed Flow</SelectItem>
                <SelectItem value="1">2: Sequential Pull-Off</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 min-w-[150px]">
            <span className="text-xs text-muted-foreground">Speed:</span>
            <Slider
              min={1}
              max={20}
              step={1}
              value={[speed]}
              onValueChange={([v]) => setSpeed(v)}
              className="w-24"
            />
            <span className="text-xs font-mono w-8">{speed}x</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 text-xs font-mono">
          <span>
            <span className="text-muted-foreground">Time: </span>
            {displayTime.toFixed(1)}s
          </span>
          <span>
            <span className="text-muted-foreground">Section: </span>
            {displayCurrent.toFixed(1)}A
          </span>
          <span>
            <span className="text-muted-foreground">System: </span>
            {derived.totalSystemCurrent.toFixed(1)}A
          </span>
          <span>
            <span className="text-muted-foreground">Carriers: </span>
            {displayCarriers}
          </span>
        </div>

        {/* Canvas */}
        <div className="w-full" style={{ height: '200px' }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full rounded-md"
            style={{ display: 'block' }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
