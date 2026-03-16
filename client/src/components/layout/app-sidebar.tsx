import { Link, useLocation } from 'wouter';
import { Home } from 'lucide-react';
import { tools } from '@/lib/tools-registry';
import sarLogo from '@assets/sar-group-logo.jpg';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

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
            <div className="hidden group-data-[collapsible=icon]:flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px] shrink-0">
              SAR
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="text-xs text-muted-foreground">Engineering Tools</span>
            </div>
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
      <SidebarRail />
    </Sidebar>
  );
}
