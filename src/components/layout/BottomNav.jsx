import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Pill, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 底部导航栏组件
 * 底部主导航
 */
const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { 
      icon: Home, 
      label: '首页', 
      path: '/dashboard',
      active: location.pathname === '/dashboard' || location.pathname === '/'
    },
    { 
      icon: Pill, 
      label: '用药', 
      path: '/medications',
      active: location.pathname.startsWith('/medications')
    },
    { 
      icon: Calendar, 
      label: '复诊', 
      path: '/appointments',
      active: location.pathname.startsWith('/appointments')
    },
    { 
      icon: User, 
      label: '我的', 
      path: '/profile',
      active: location.pathname === '/profile' || location.pathname.startsWith('/settings')
    },
  ];

  const handleNavClick = (path) => {
    navigate(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50 safe-area-bottom">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors min-w-[64px]",
                item.active 
                  ? "text-green-600 bg-green-50" 
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Icon className="w-6 h-6" strokeWidth={item.active ? 2.5 : 2} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
