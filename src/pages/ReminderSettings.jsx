import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUIStore } from '@/store/uiStore';

const ReminderSettings = () => {
  const navigate = useNavigate();
  const { setPageTitle } = useUIStore();

  useEffect(() => {
    setPageTitle('提醒设置');
  }, [setPageTitle]);

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <div className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/profile')}
          className="mr-2"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1">提醒设置</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <Bell className="w-5 h-5" />
              本阶段未启用通知
            </CardTitle>
            <CardDescription className="text-amber-700">
              当前迁移版本只保证登录、在线保存和核心 CRUD 跑通。
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-amber-800 leading-relaxed">
            系统通知、Web Push、短信提醒和复杂提醒策略会在后续版本单独设计与验收。当前用药提醒时间仍保存在用药计划中，可用于页面展示。
          </CardContent>
        </Card>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => toast.info('通知能力本阶段未启用')}
        >
          <Bell className="w-4 h-4 mr-2" />
          测试提醒
        </Button>
      </div>
    </div>
  );
};

export default ReminderSettings;
