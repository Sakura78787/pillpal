
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  LogOut, 
  User,
  Database,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import DataExport from '@/components/settings/DataExport';
import { useAuthStore } from '@/store/authStore';

/**
 * 设置页面 - 数据管理中心
 */
const Settings = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const [storageInfo, setStorageInfo] = useState({ used: 0, total: 0 });

  // 计算存储使用情况
  useEffect(() => {
    const calculateStorage = async () => {
      try {
        // 估算本地存储使用量（简化计算）
        const estimate = await navigator.storage?.estimate?.() || {};
        const used = estimate.usage || 0;
        const total = estimate.quota || 50 * 1024 * 1024; // 默认50MB
        
        setStorageInfo({
          used: Math.round(used / 1024 / 1024 * 100) / 100, // MB
          total: Math.round(total / 1024 / 1024 * 100) / 100
        });
      } catch (error) {
        console.error('计算存储使用失败:', error);
      }
    };

    calculateStorage();
  }, []);

  // 处理退出登录
  const handleLogout = async () => {
    try {
      await logout();
      toast.success('已退出登录');
      navigate('/login');
    } catch (error) {
      toast.error('退出登录失败');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* 顶部导航 */}
      <div className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/profile')}
          className="mr-2"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1">数据管理</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* 用户信息卡片 */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  {user?.username || user?.email || '用户'}
                </h3>
                <p className="text-sm text-gray-500">
                  已登录，核心数据在线保存
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 数据导入导出 - 核心功能 */}
        <DataExport />

        {/* 数据管理 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              本地偏好设置
            </CardTitle>
            <CardDescription>
              仅保存主题、字号等非业务数据
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 存储使用情况 */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">存储空间使用</span>
                <span className="font-medium">
                  {storageInfo.used}MB / {storageInfo.total}MB
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ 
                    width: `${Math.min((storageInfo.used / storageInfo.total) * 100, 100)}%` 
                  }}
                />
              </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-700">
                清除云端业务数据会涉及不可撤销删除，本阶段先不提供一键清除入口。
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* 关于与帮助 */}
        <Card>
          <CardHeader>
            <CardTitle>关于</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">版本</span>
              <span>v1.2.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">开发者</span>
              <span>慢病用药小管家团队</span>
            </div>
            <Alert className="mt-4 bg-blue-50 border-blue-200">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-700">
                <p className="font-medium mb-1">数据安全提示</p>
                <p>核心数据保存在自有 Supabase 项目中；请勿录入真实诊疗或处方敏感数据用于演示。</p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* 退出登录 */}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          退出登录
        </Button>
      </div>
    </div>
  );
};

export default Settings;
