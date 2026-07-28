import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, List, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import LogCalendar from '@/components/logs/LogCalendar';
import LogList from '@/components/logs/LogList';
import { useAuthStore } from '@/store/authStore';
import { useLogStore } from '@/store/logStore';
import { useMedicationStore } from '@/store/medicationStore';
import { useUIStore } from '@/store/uiStore';
import { format, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';

/**
 * 服药记录历史页面
 * 展示用户的服药打卡记录，支持日历和列表两种视图
 * 
 * 修复：
 * 1. 日历视图点击某天跳转到该天记录
 * 2. 列表视图默认显示当天记录
 */

const Logs = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { logs, isLoading, loadLocalLogs, syncFromCloud } = useLogStore();
  const { medications, loadLocalMedications } = useMedicationStore();
  const { setPageTitle } = useUIStore();

  // 关键修复：从URL参数获取日期，否则默认今天
  const getInitialDate = () => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsed = parseISO(dateParam);
      if (isValid(parsed)) return parsed;
    }
    return new Date();
  };

  const [selectedDate, setSelectedDate] = useState(getInitialDate());
  const [viewMode, setViewMode] = useState(() => {
    // 如果有date参数，默认显示列表视图
    return searchParams.get('date') ? 'list' : 'calendar';
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // 设置页面标题
  useEffect(() => {
    setPageTitle('服药记录');
  }, [setPageTitle]);

  // 加载数据
  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user]);

  // 关键修复：当selectedDate变化时，加载对应日期的记录
  useEffect(() => {
    if (user?.id && selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      loadLocalLogs(user.id, dateStr);
    }
  }, [user, selectedDate]);

  const loadData = async () => {
    setIsSyncing(true);
    try {
      // 加载用药计划（用于显示药物名称）
      await loadLocalMedications(user.id);
      
      // 加载本月记录
      const startDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      await syncFromCloud(user.id, startDate, endDate);
      
      // 加载选中日期的记录
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      await loadLocalLogs(user.id, dateStr);
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error('数据加载失败');
    } finally {
      setIsSyncing(false);
    }
  };

  // 关键修复：处理日期点击 - 跳转到列表视图显示该天记录
  const handleDateClick = (date) => {
    setSelectedDate(date);
    setViewMode('list');
    // 更新URL参数
    setSearchParams({ date: format(date, 'yyyy-MM-dd') });
  };

  // 关键修复：获取选中日期对应的记录
  const selectedDateLogs = logs.filter(log => {
    return log.scheduled_date === format(selectedDate, 'yyyy-MM-dd');
  });

  // 获取统计数据（基于选中日期）
  const getStats = () => {
    const targetLogs = selectedDateLogs;
    const total = targetLogs.length;
    const taken = targetLogs.filter(l => l.status === 'taken').length;
    const skipped = targetLogs.filter(l => l.status === 'skipped').length;
    const rate = total > 0 ? Math.round((taken / total) * 100) : 0;
    
    return { total, taken, skipped, rate };
  };

  const stats = getStats();

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* 顶部导航 */}
      <div className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/dashboard')}
          className="mr-2"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1">服药记录</h1>
        {isSyncing && (
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>

      {/* 关键修复：显示当前查看的日期 */}
      <div className="px-4 py-2">
        <Card className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 border-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {format(selectedDate, 'yyyy年MM月dd日')}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {selectedDateLogs.length > 0 
                  ? `共${selectedDateLogs.length}条记录` 
                  : '无记录'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">{stats.rate}%</div>
              <div className="text-xs text-gray-500">完成率</div>
            </div>
          </div>
        </Card>
      </div>

      {/* 视图切换 */}
      <div className="px-4">
        <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              日历视图
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              列表视图
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-0">
            <LogCalendar
              logs={logs}
              onDateClick={handleDateClick}
              selectedDate={selectedDate}
            />
          </TabsContent>

          <TabsContent value="list" className="mt-0">
            {/* 关键修复：显示选中日期或当天的记录 */}
            {selectedDateLogs.length === 0 ? (
              <Card className="p-8 text-center border-dashed border-2">
                <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  当日无服药记录
                </h3>
                <p className="text-sm text-gray-500">
                  {format(selectedDate, 'yyyy年MM月dd日')}没有服药记录
                </p>
              </Card>
            ) : (
              <LogList logs={selectedDateLogs} medications={medications} />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* 底部提示 */}
      <div className="px-4 mt-6">
        <p className="text-xs text-gray-400 text-center">
          数据登录后在线保存，换设备登录可查看已保存记录
        </p>
      </div>
    </div>
  );
};

export default Logs;
