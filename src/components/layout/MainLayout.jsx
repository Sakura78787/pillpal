import BottomNav from './BottomNav';
import GuestExperienceBanner from './GuestExperienceBanner';
import { useAuthStore } from '@/store/authStore';
import { AuthStatus } from '@/types/auth';

/**
 * 主布局组件
 * 包含底部导航栏的内容区域包装器
 */
const MainLayout = ({ children, showNav = true }) => {
  const { authStatus } = useAuthStore();
  return (
    <div className="min-h-screen bg-gray-50">
      {authStatus === AuthStatus.GUEST && <GuestExperienceBanner />}
      {/* 主内容区域 */}
      <main className={showNav ? "pb-20" : ""}>
        {children}
      </main>
      
      {/* 底部导航 */}
      {showNav && <BottomNav />}
    </div>
  );
};

export default MainLayout;
