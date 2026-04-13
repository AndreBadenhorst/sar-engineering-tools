import { Link, useLocation } from 'wouter';
import { Home, Sun, Moon, CalendarDays, FolderKanban, BookOpen, Package, ScanBarcode, ClipboardCheck, Train, FileText } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import sarLogo from '@assets/sar-group-logo-blue.png';
import sarLogoSquare from '@assets/sar-logo-square.png';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={toggle} tooltip={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

type NavItem = { label: string; icon: typeof Home; path: string; tooltip?: string };

const PLANNING: NavItem[] = [
  { label: "Capacity", icon: CalendarDays, path: "/tools/capacity-planner" },
  { label: "Projects", icon: FolderKanban, path: "/tools/project-list" },
];

const WAREHOUSE: NavItem[] = [
  { label: "Parts Catalog", icon: BookOpen, path: "/tools/parts-catalog" },
  { label: "Inventory", icon: Package, path: "/tools/inventory" },
  { label: "Book Stock", icon: ScanBarcode, path: "/tools/stock-booking" },
  { label: "Stocktake", icon: ClipboardCheck, path: "/tools/stocktake" },
];

const ENGINEERING: NavItem[] = [
  { label: "Railcut Sizing", icon: Train, path: "/tools/railcut-sizing" },
];

function NavGroup({ label, items, location }: { label: string; items: NavItem[]; location: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton asChild isActive={location === item.path} tooltip={item.tooltip || item.label}>
                <Link href={item.path}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href="/">
          <div className="flex items-center gap-2 px-2 py-1 cursor-pointer">
            <img
              src={sarLogo}
              alt="SAR Group"
              className="h-8 shrink-0 group-data-[collapsible=icon]:hidden"
            />
            <img
              src={sarLogoSquare}
              alt="SAR"
              className="hidden group-data-[collapsible=icon]:flex h-8 w-8 shrink-0 rounded"
            />
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === '/'} tooltip="Dashboard">
                  <Link href="/">
                    <Home className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <NavGroup label="Planning" items={PLANNING} location={location} />
        <NavGroup label="Warehouse" items={WAREHOUSE} location={location} />
        <NavGroup label="Engineering" items={ENGINEERING} location={location} />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === '/docs'} tooltip="Documentation">
                  <Link href="/docs">
                    <FileText className="h-4 w-4" />
                    <span>Documentation</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <ThemeToggle />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
