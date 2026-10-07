import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Warehouse, ClipboardList, RotateCcw, History as HistoryIcon,
  ArrowRightLeft, QrCode, MapPinned, BarChart3, Factory, ShieldCheck, Truck, GitBranch, Menu, PanelLeftClose, PanelLeftOpen,
  Sun, Moon, Monitor, LogOut,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const navGroups = [
  {
    label: 'Vận hành',
    items: [
      { to: '/', label: 'Tổng quan', icon: LayoutDashboard, end: true },
      { to: '/inventory', label: 'Nhập · Xuất · Điều chuyển', short: 'Nhập · Xuất', icon: ArrowRightLeft },
      { to: '/orders', label: 'Lô linh kiện', icon: Package },
      { to: '/qr-labels', label: 'QR & Barcode kho', short: 'QR', icon: QrCode },
    ],
  },
  {
    label: 'Kho',
    items: [
      { to: '/racks', label: 'Sơ đồ kho theo Zone', short: 'Sơ đồ kho', icon: Warehouse },
      { to: '/zones', label: 'Quản lý Zone', icon: MapPinned },
      { to: '/packing-rules', label: 'Quy ước lưu kho', icon: ClipboardList },
    ],
  },
  {
    label: 'Chuỗi cung ứng',
    items: [
      { to: '/work-orders', label: 'Kế hoạch sản xuất', short: 'Sản xuất', icon: Factory },
      { to: '/inspections', label: 'Kiểm tra chất lượng', short: 'Chất lượng', icon: ShieldCheck },
      { to: '/shipments', label: 'Giao hàng', icon: Truck },
      { to: '/trace', label: 'Truy vết theo lô', short: 'Truy vết', icon: GitBranch },
    ],
  },
  {
    label: 'Theo dõi',
    items: [
      { to: '/reports', label: 'Báo cáo kho', icon: BarChart3 },
      { to: '/history', label: 'Lịch sử kho', icon: HistoryIcon },
    ],
  },
];

const bottomTabs = ['/', '/inventory', '/qr-labels', '/racks'];
const allItems = navGroups.flatMap((g) => g.items);

const THEME_CYCLE = { light: 'dark', dark: 'system', system: 'light' };
const THEME_META = {
  light: { icon: Sun, label: 'Giao diện sáng' },
  dark: { icon: Moon, label: 'Giao diện tối' },
  system: { icon: Monitor, label: 'Theo hệ thống' },
};

function WithTip({ enabled, label, children }) {
  if (!enabled) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function SidebarBody({ collapsed = false, onNavigate, onToggleCollapse }) {
  const { resetData } = useStore();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const ThemeIcon = THEME_META[theme].icon;
  const displayName = user?.fullName || user?.email || 'Tài khoản';
  const initial = displayName.trim().charAt(0).toUpperCase();

  const footBtn =
    'flex items-center gap-3 h-9 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring';

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn('flex items-center h-16 shrink-0 border-b border-sidebar-border', collapsed ? 'justify-center' : 'gap-3 px-5')}>
        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <Warehouse className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight truncate">DENSO WMS</p>
            <p className="text-[11px] text-sidebar-foreground/70 truncate">Kho linh kiện ô tô</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Điều hướng chính">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            {collapsed ? (
              <div className="mx-3 mb-2 border-t border-sidebar-border first:hidden" aria-hidden="true" />
            ) : (
              <p className="px-3 pb-1 text-xs font-medium text-sidebar-foreground/50">{group.label}</p>
            )}
            {group.items.map((item) => (
              <WithTip key={item.to} enabled={collapsed} label={item.label}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  aria-label={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center h-10 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                      collapsed ? 'justify-center' : 'gap-3 px-3',
                      isActive
                        ? 'bg-sidebar-accent text-white before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-sidebar-primary'
                        : 'hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                    )
                  }
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </WithTip>
            ))}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3 space-y-1">
        <WithTip enabled={collapsed} label={THEME_META[theme].label}>
          <button
            type="button"
            onClick={() => setTheme(THEME_CYCLE[theme])}
            aria-label={`${THEME_META[theme].label}. Bấm để đổi`}
            className={cn(footBtn, 'w-full', collapsed ? 'justify-center' : 'px-3')}
          >
            <ThemeIcon className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>{THEME_META[theme].label}</span>}
          </button>
        </WithTip>

        <AlertDialog>
          <WithTip enabled={collapsed} label="Làm mới dữ liệu">
            <AlertDialogTrigger asChild>
              <button type="button" aria-label="Làm mới dữ liệu" className={cn(footBtn, 'w-full', collapsed ? 'justify-center' : 'px-3')}>
                <RotateCcw className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && <span>Làm mới dữ liệu</span>}
              </button>
            </AlertDialogTrigger>
          </WithTip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tải lại dữ liệu từ máy chủ?</AlertDialogTitle>
              <AlertDialogDescription>
                Hệ thống sẽ tải lại dữ liệu hiện tại từ cơ sở dữ liệu. Không xóa dữ liệu.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={resetData}>Tải lại</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {onToggleCollapse && (
          <WithTip enabled={collapsed} label="Mở rộng thanh bên">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
              className={cn(footBtn, 'w-full', collapsed ? 'justify-center' : 'px-3')}
            >
              {collapsed ? <PanelLeftOpen className="w-[18px] h-[18px]" /> : <PanelLeftClose className="w-[18px] h-[18px] shrink-0" />}
              {!collapsed && <span>Thu gọn</span>}
            </button>
          </WithTip>
        )}

        <div className={cn('flex items-center pt-2 mt-1 border-t border-sidebar-border', collapsed ? 'justify-center' : 'gap-3 px-1')}>
          <div className="w-8 h-8 rounded-full bg-sidebar-accent text-white text-sm font-semibold flex items-center justify-center shrink-0" aria-hidden="true">
            {initial}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                {user?.role && <p className="text-[11px] text-sidebar-foreground/60 truncate">{String(user.role).toLowerCase()}</p>}
              </div>
              <button
                type="button"
                onClick={logout}
                aria-label="Đăng xuất"
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-sidebar-accent hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
        {collapsed && (
          <WithTip enabled label="Đăng xuất">
            <button
              type="button"
              onClick={logout}
              aria-label="Đăng xuất"
              className={cn(footBtn, 'w-full justify-center')}
            >
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </WithTip>
        )}
      </div>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('wms-sidebar-collapsed') === '1'; } catch { return false; }
  });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('wms-sidebar-collapsed', collapsed ? '1' : '0'); } catch { /* bỏ qua */ }
  }, [collapsed]);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const current = allItems.find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)));
  const tabs = bottomTabs.map((to) => allItems.find((i) => i.to === to));

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-slate-50">
        <aside
          className={cn(
            'hidden md:block fixed inset-y-0 left-0 z-30 border-r border-sidebar-border transition-[width] duration-200',
            collapsed ? 'w-[72px]' : 'w-72',
          )}
        >
          <SidebarBody collapsed={collapsed} onToggleCollapse={() => setCollapsed((v) => !v)} />
        </aside>

        <header className="md:hidden fixed top-0 inset-x-0 h-14 z-30 flex items-center gap-3 px-4 bg-sidebar text-white border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Warehouse className="w-4 h-4 text-white" />
          </div>
          <p className="text-sm font-semibold truncate">{current?.label || 'DENSO WMS'}</p>
        </header>

        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
          aria-label="Điều hướng nhanh"
        >
          {tabs.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] font-medium focus-visible:outline-none focus-visible:bg-slate-100',
                  isActive ? 'text-indigo-600' : 'text-slate-500',
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="truncate max-w-full px-1">{item.short || item.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] font-medium text-slate-500 focus-visible:outline-none focus-visible:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
            Menu
          </button>
        </nav>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="p-0 w-72 border-sidebar-border bg-sidebar [&>button]:text-white">
            <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
            <SheetDescription className="sr-only">Danh sách các trang của hệ thống kho</SheetDescription>
            <SidebarBody onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        <main
          className={cn(
            'min-h-screen pt-14 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pt-0 md:pb-0 transition-[margin] duration-200',
            collapsed ? 'md:ml-[72px]' : 'md:ml-72',
          )}
        >
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  );
}
