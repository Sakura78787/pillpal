import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ChevronRight, 
  User, 
  Bell, 
  Shield, 
  Settings,
  Stethoscope,
  Heart,
  Calendar,
  FileText,
  Loader2,
  Activity,
  Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useMedicationStore } from '@/store/medicationStore';
import { useHealthStore } from '@/store/healthStore';
import { useLogStore } from '@/store/logStore';
import { useAppointmentStore } from '@/store/appointmentStore';
import { useUIStore } from '@/store/uiStore';
import { AuthStatus } from '@/types/auth';

export const ProfileCareLink = ({ children } = {}) => (
  <Link to="/care" className="block">{children}</Link>
);

export const ProfileMenu = ({ navigate, isGuest = false }) => {
  const menuItems = [
    {
      icon: Heart,
      label: '家人照护',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      description: '只读查看最近 7 天照护信息',
      href: '/care'
    },
    {
      icon: Activity,
      label: '健康档案',
      color: 'text-rose-500',
      bgColor: 'bg-rose-50',
      description: '记录血压、血糖、体重等健康数据',
      onClick: () => navigate('/health')
    },
    {
      icon: Bell,
      label: '提醒设置',
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
      onClick: () => navigate('/profile/reminders')
    },
    {
      icon: Database,
      label: '数据管理',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      description: '导入导出、备份恢复',
      onClick: () => navigate('/settings')
    },
    {
      icon: Settings,
      label: '通用设置',
      color: 'text-gray-500',
      bgColor: 'bg-gray-50',
      onClick: () => toast.info('功能开发中，敬请期待')
    }
  ];

  const visibleItems = isGuest ? menuItems.filter((item) => !['提醒设置', '数据管理'].includes(item.label)) : menuItems;

  return (
    <div className="px-4 py-6 space-y-3">
      <h3 className="text-sm font-medium text-gray-500 px-1">功能</h3>
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const card = (
          <Card
            key={item.label}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={item.onClick}
          >
            <CardContent className="p-4 flex items-center">
              <div className={`w-10 h-10 ${item.bgColor} rounded-lg flex items-center justify-center mr-3`}>
                <Icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{item.label}</div>
                {item.description && <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>}
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </CardContent>
          </Card>
        );
        return item.href ? <ProfileCareLink key={item.label}>{card}</ProfileCareLink> : card;
      })}
    </div>
  );
};

/**
 * 个人中心页面
 * 展示用户信息、快捷统计、功能菜单
 */
const Profile = () => {
  const navigate = useNavigate();
  const { user, authStatus } = useAuthStore();
  const isGuest = authStatus === AuthStatus.GUEST;
  const { medications } = useMedicationStore();
  const { records } = useHealthStore();
  const { setPageTitle } = useUIStore();

  const [stats, setStats] = useState({
    streak: 0,
    medications: 0,
    healthRecords: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  // 设置页面标题
  useEffect(() => {
    setPageTitle('我的');
  }, [setPageTitle]);

  // 加载统计数据
  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        // 从localStorage读取连续打卡天数
        const streakData = isGuest ? null : localStorage.getItem('streak_data');
        const streak = streakData ? JSON.parse(streakData).currentStreak || 0 : 0;

        // 统计活跃药物数量
        const activeMeds = medications.filter(m => m.status === 'active').length;
        
        // 关键修复：确保健康记录数据已加载后再统计
        // 如果 healthStore 中的 records 为空，尝试重新加载
        let healthCount = records.length;
        if (healthCount === 0 && user?.id) {
          // 尝试从本地加载健康记录
          const { useHealthStore } = await import('@/store/healthStore');
          const healthStore = useHealthStore.getState();
          await healthStore.loadLocalRecords(user.id);
          healthCount = healthStore.records.length;
        }

        setStats({
          streak,
          medications: activeMeds,
          healthRecords: healthCount
        });
      } catch (error) {
        console.error('加载统计数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [medications, records, user, isGuest]);

  // 可爱的表情头像数组
  const avatars = ['🐻', '🐼', '🐨', '🐯', '🦁', '🐷', '🐸', '🐙', '🦄', '🐝'];
  
  // 根据用户ID固定选择一个头像
  const getUserAvatar = () => {
    if (!user?.id) return avatars[0];
    const index = user.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % avatars.length;
    return avatars[index];
  };

  // 处理退出登录
  const handleLogout = async () => {
    try {
      const { logout } = useAuthStore.getState();
      await logout();
      toast.success('已退出登录');
      navigate('/login');
    } catch (error) {
      toast.error('退出登录失败');
    }
  };

  const handleResetGuestExperience = () => {
    if (!window.confirm('将清空本次访客操作并恢复合成示例数据，是否继续？')) return;
    const result = useAuthStore.getState().resetGuestSession();
    if (result.success) {
      useMedicationStore.setState({ medications: result.session.medications, selectedMedication: null });
      useHealthStore.setState({ records: result.session.healthRecords, todayRecords: [] });
      useLogStore.setState({ logs: result.session.medicationLogs, todayLogs: [] });
      useAppointmentStore.setState({ appointments: result.session.appointments, selectedAppointment: null });
      toast.success('访客体验已重置为合成示例数据');
    } else {
      toast.error(result.error || '重置失败，请稍后重试');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 用户信息卡片 */}
      <div className="bg-white px-4 pt-6 pb-8 rounded-b-3xl shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center text-4xl shadow-inner">
            {getUserAvatar()}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {isGuest ? '访客体验' : user?.username || user?.email || '用户'}
            </h2>
            <p className="text-sm text-gray-500">
              {isGuest ? '数据仅在当前标签页会话内保留，不上传云端' : '已登录，核心数据在线保存'}
            </p>
          </div>
        </div>

        {/* 快捷统计 */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {stats.streak}
              </div>
              <div className="text-xs text-gray-600">连续打卡</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-100">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {stats.medications}
              </div>
              <div className="text-xs text-gray-600">用药计划</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-rose-100">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-rose-600 mb-1">
                {stats.healthRecords}
              </div>
              <div className="text-xs text-gray-600">健康记录</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ProfileMenu navigate={navigate} isGuest={isGuest} />

      {/* 关于我们 */}
      <div className="px-4 py-2">
        <h3 className="text-sm font-medium text-gray-500 px-1 mb-3">关于</h3>
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/about')}
        >
          <CardContent className="p-4 flex items-center">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mr-3">
              <Heart className="w-5 h-5 text-purple-500" />
            </div>
            <span className="flex-1 font-medium text-gray-900">关于我们</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </CardContent>
        </Card>
      </div>

      {isGuest ? (
        <div className="space-y-3 px-4 py-6">
          <Button variant="outline" className="w-full" onClick={handleResetGuestExperience}>重置体验</Button>
          <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => navigate('/login')}>登录使用云端版</Button>
        </div>
      ) : (
      <div className="px-4 py-6">
        <Button 
          variant="outline" 
          className="w-full"
          onClick={handleLogout}
        >
          退出登录
        </Button>
      </div>
      )}

      {/* 医学免责声明 */}
      <div className="px-6 py-4 text-center">
        <p className="text-xs text-gray-400 leading-relaxed mb-2">
          本应用为健康管理工具，提供的内容仅供参考，不构成任何专业医疗建议。如有健康问题，请及时咨询专业医生。
        </p>
      </div>

      {/* 版本信息 */}
      <div className="text-center py-4">
        <p className="text-xs text-gray-400">慢病用药小管家 v1.2.0</p>
      </div>
    </div>
  );
};

export default Profile;
