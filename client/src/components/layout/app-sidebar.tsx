import { Link, useLocation } from 'wouter';
import { Home, Info, Sun, Moon } from 'lucide-react';
import { tools } from '@/lib/tools-registry';
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
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === '/'} tooltip="Home">
                  <Link href="/">
                    <Home className="h-4 w-4" />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === '/about'} tooltip="About">
                  <Link href="/about">
                    <Info className="h-4 w-4" />
                    <span>About</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tools.map((tool) => {
                const Icon = tool.icon;
                const isActive = location === tool.path;
                return (
                  <SidebarMenuItem key={tool.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={tool.shortName}
                    >
                      <Link href={tool.path}>
                        <Icon className="h-4 w-4" />
                        <span>{tool.shortName}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
