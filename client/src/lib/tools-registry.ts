import { Train, Calculator, Zap, Cable, CalendarDays, FolderKanban, Package, ScanBarcode, BookOpen, ClipboardCheck } from "lucide-react";
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
    id: 'capacity-planner',
    name: 'Capacity Planner',
    shortName: 'Capacity',
    description: 'Weekly team capacity planning — assign team members to projects by day with activity tracking.',
    icon: CalendarDays,
    path: '/tools/capacity-planner',
    category: 'general',
    status: 'active',
  },
  {
    id: 'project-list',
    name: 'Project List',
    shortName: 'Projects',
    description: 'View and manage all projects — filter by status, source, and search. Toggle active/inactive status.',
    icon: FolderKanban,
    path: '/tools/project-list',
    category: 'general',
    status: 'active',
  },
  {
    id: 'parts-catalog',
    name: 'Parts Catalog',
    shortName: 'Parts',
    description: 'Browse, search, and manage the parts database — customer pricing, install times, datasheets, and manufacturer/vendor filters.',
    icon: BookOpen,
    path: '/tools/parts-catalog',
    category: 'general',
    status: 'active',
  },
  {
    id: 'inventory',
    name: 'Inventory Manager',
    shortName: 'Inventory',
    description: 'Manage parts, stock levels, storage locations, and transaction history. Track reorder points and low stock alerts.',
    icon: Package,
    path: '/tools/inventory',
    category: 'general',
    status: 'active',
  },
  {
    id: 'stock-booking',
    name: 'Stock Booking',
    shortName: 'Book Stock',
    description: 'Mobile-friendly tool — book parts out of inventory, confirm shelf counts, and get low-stock reorder alerts.',
    icon: ScanBarcode,
    path: '/tools/stock-booking',
    category: 'general',
    status: 'active',
  },
  {
    id: 'stocktake',
    name: 'Stocktake',
    shortName: 'Stocktake',
    description: 'Mobile-friendly cycle count tool — walk locations, count parts, submit adjustments.',
    icon: ClipboardCheck,
    path: '/tools/stocktake',
    category: 'general',
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
