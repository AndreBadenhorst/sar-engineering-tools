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
  // Future tools go here:
  // {
  //   id: 'cable-sizing',
  //   name: 'Supply Cable Sizing Calculator',
  //   shortName: 'Cable Sizing',
  //   description: 'Calculate required cable cross-sections based on current, voltage drop, and derating factors.',
  //   icon: Cable,
  //   path: '/tools/cable-sizing',
  //   category: 'power',
  //   status: 'coming-soon',
  // },
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
