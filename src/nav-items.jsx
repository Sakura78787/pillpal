import { 
  Home, 
  Pill, 
  Calendar, 
  User,
  History,
  Package,
  Heart
} from 'lucide-react';
import Dashboard from '@/pages/Dashboard';
import Medications from '@/pages/Medications';
import AddMedication from '@/pages/AddMedication';
import EditMedication from '@/pages/EditMedication';
import Logs from '@/pages/Logs';
import Appointments from '@/pages/Appointments';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import Inventory from '@/pages/Inventory';
import Health from '@/pages/Health';
import ReminderSettings from '@/pages/ReminderSettings';
import About from '@/pages/About';

/**
 * 导航配置
 * 包含底部导航和页面路由配置
 */
export const bottomNavItems = [
  {
    path: '/dashboard',
    label: '首页',
    icon: Home,
    component: Dashboard
  },
  {
    path: '/medications',
    label: '用药',
    icon: Pill,
    component: Medications
  },
  {
    path: '/inventory',
    label: '库存',
    icon: Package,
    component: Inventory
  },
  {
    path: '/health',
    label: '健康',
    icon: Heart,
    component: Health
  },
  {
    path: '/profile',
    label: '我的',
    icon: User,
    component: Profile
  }
];

/**
 * 所有页面路由配置
 * 包含底部导航页面和其他页面
 */
export const allRoutes = [
  // 底部导航页面
  ...bottomNavItems,
  
  // 其他页面
  {
    path: '/medications/add',
    component: AddMedication
  },
  {
    path: '/medications/edit/:id',
    component: EditMedication
  },
  {
    path: '/logs',
    component: Logs
  },
  {
    path: '/appointments',
    component: Appointments
  },
  {
    path: '/settings',
    component: Settings
  },
  {
    path: '/login',
    component: Login
  },
  {
    path: '/profile/reminders',
    component: ReminderSettings
  },
  {
    path: '/about',
    component: About
  }
];

/**
 * 需要登录才能访问的路由
 */
export const protectedRoutes = [
  '/dashboard',
  '/medications',
  '/medications/add',
  '/medications/edit/:id',
  '/logs',
  '/appointments',
  '/profile',
  '/settings',
  '/inventory',
  '/health',
  '/profile/reminders',
  '/about'
];

/**
 * 公开路由（无需登录）
 */
export const publicRoutes = [
  '/login'
];

export default bottomNavItems;
