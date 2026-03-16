import { useEffect } from 'react';
import { Switch, Route, Router, useLocation } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { PerplexityAttribution } from '@/components/PerplexityAttribution';
import { getToolById } from '@/lib/tools-registry';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import RailcutSizing from '@/pages/railcut-sizing';
import CableSizing from '@/pages/cable-sizing';

function PageTitle() {
  const [location] = useLocation();
  if (location === '/') return <AppHeader title="Engineering Tools" />;
  const match = location.match(/^\/tools\/(.+)$/);
  if (match) {
    const tool = getToolById(match[1]);
    if (tool) return <AppHeader title={tool.name} />;
  }
  return <AppHeader title="Not Found" />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tools/railcut-sizing" component={RailcutSizing} />
      <Route path="/tools/cable-sizing" component={CableSizing} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <PageTitle />
              <div className="flex-1 overflow-auto">
                <AppRouter />
              </div>
              <PerplexityAttribution />
            </SidebarInset>
          </SidebarProvider>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
