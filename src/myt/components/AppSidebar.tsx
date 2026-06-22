import { Link, useLocation } from '@/shims/react-router-dom';
import {
  LayoutDashboard, CalendarPlus, Users, FileText, BarChart3,
  Building2, Menu, X, ChevronLeft, ChevronRight, Target, TrendingUp,
  Trophy, Wallet, CalendarDays, Crosshair, Zap, Boxes
} from 'lucide-react';
import { useAppState } from '@/myt/lib/app-context';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

const navItems = {
  hr: [
    { label: 'War Room', path: '/myt/war-room', icon: Crosshair },
    { label: 'HR Tower', path: '/myt', icon: LayoutDashboard },
    { label: 'Properties', path: '/myt/properties', icon: Boxes },
    { label: 'Funnel', path: '/myt/funnel', icon: TrendingUp },
    { label: 'Team', path: '/myt/team', icon: Users },
    { label: 'Zones', path: '/myt/zones', icon: BarChart3 },
    { label: 'Drafts', path: '/myt/drafts', icon: FileText },
    { label: 'Tours', path: '/myt/tours', icon: CalendarPlus },
    { label: 'Leaderboard', path: '/myt/leaderboard', icon: Trophy },
    { label: 'Bookings', path: '/myt/bookings', icon: Wallet },
  ],
  'flow-ops': [
    { label: 'Dashboard', path: '/myt/flow-ops', icon: LayoutDashboard },
    { label: 'Schedule', path: '/myt/schedule', icon: CalendarPlus },
    { label: 'Marketplace', path: '/myt/marketplace', icon: Zap },
    { label: 'Properties', path: '/myt/properties', icon: Boxes },
    { label: 'Calendar', path: '/myt/calendar', icon: CalendarDays },
    { label: 'Leads', path: '/myt/leads', icon: Target },
  ],
  tcm: [
    { label: 'Tours', path: '/myt/tcm', icon: LayoutDashboard },
    { label: 'Marketplace', path: '/myt/marketplace', icon: Zap },
    { label: 'Calendar', path: '/myt/calendar', icon: CalendarDays },
    { label: 'Actions', path: '/myt/tcm/actions', icon: CalendarPlus },
    { label: 'Stats', path: '/myt/tcm/performance', icon: BarChart3 },
  ],
};

const roleLabels = { hr: 'HR', 'flow-ops': 'Flow Ops', tcm: 'TCM' };
const roleColors = { hr: 'bg-role-hr', 'flow-ops': 'bg-role-flow', tcm: 'bg-role-tcm' };

export function AppSidebar() {
  const { currentRole, setCurrentRole } = useAppState();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = navItems[currentRole];

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-12 bg-sidebar border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="font-heading font-bold text-foreground">GHARPAYY</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-foreground p-1">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile slide-out */}
      <div className={cn(
        'md:hidden fixed top-12 left-0 bottom-0 z-40 w-64 bg-sidebar border-r border-border transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <MobileNavContent currentRole={currentRole} setCurrentRole={setCurrentRole} items={items} location={location} />
      </div>

      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden md:flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300 shrink-0 sticky top-0',
        collapsed ? 'w-16' : 'w-56'
      )}>
        <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
          <Building2 className="h-5 w-5 text-primary shrink-0" />
          {!collapsed && <span className="font-heading font-bold text-foreground">GHARPAYY</span>}
        </div>

        <div className="px-2 py-2 border-b border-border">
          {(['hr', 'flow-ops', 'tcm'] as const).map(role => (
            <button
              key={role}
              onClick={() => setCurrentRole(role)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors mb-0.5',
                currentRole === role ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full shrink-0', roleColors[role])} />
              {!collapsed && <span>{roleLabels[role]}</span>}
            </button>
          ))}
        </div>

        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {items.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 border-t border-border text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Mobile bottom nav - show first 5 items */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-border">
        <div className="flex justify-around items-center h-14">
          {items.slice(0, 5).map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1 rounded-md transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

function MobileNavContent({ currentRole, setCurrentRole, items, location }: any) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Switch Role</p>
        <div className="flex gap-1">
          {(['hr', 'flow-ops', 'tcm'] as const).map(role => (
            <button
              key={role}
              onClick={() => setCurrentRole(role)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-colors',
                currentRole === role ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full', roleColors[role])} />
              {roleLabels[role]}
            </button>
          ))}
        </div>
      </div>
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {items.map((item: any) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
