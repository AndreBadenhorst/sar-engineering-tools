import { Train, Calculator, Zap, Cable } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ToolDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: LucideIcon;
  path: string;
  category: 'power' | 'mechanical' | 'general';
  status: 'active' | 'coming-soon';
}

export const tools: ToolDefinition[] = [
  {
    id: 'railcut-sizing',
    name: 'EHB Railcut Power Section Sizing',
    shortName: 'Railcut Sizing',
    description: 'Simulate carrier current draw through monorail feed sections and check against Class CC fuse trip curves (Littelfuse KLKR030, 30 A). Supports full speed flow and sequential pull-off scenarios.',
    icon: Train,
    path: '/tools/railcut-sizing',
    category: 'power',
    status: 'active',
  },
  {
    id: 'cable-sizing',
    name: 'Power Section Layout & Cable Schedule',
    shortName: 'Cable Schedule',
    description: 'Calculate power section layout, cable sizing, and generate cable schedules for EHB monorail feed sections. IEC 60364-5-52 voltage drop and ampacity sizing with full BOM export.',
    icon: Cable,
    path: '/tools/cable-sizing',
    category: 'power',
    status: 'active',
  },
];

export function getToolById(id: string): ToolDefinition | undefined {
  return tools.find(t => t.id === id);
}

export function getActiveTools(): ToolDefinition[] {
  return tools.filter(t => t.status === 'active');
}

export function getToolsByCategory(category: ToolDefinition['category']): ToolDefinition[] {
  return tools.filter(t => t.category === category);
}
