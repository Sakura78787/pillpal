import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, AlertCircle, Bell, Calendar, ChevronRight, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import DateNavigator from '@/components/dashboard/DateNavigator';
import ProgressRing from '@/components/dashboard/ProgressRing';
import TimeGroup from '@/components/dashboard/TimeGroup';
import CheckInModal from '@/components/dashboard/CheckInModal';
import StockAlert from '@/components/inventory/StockAlert';
import StockManager from '@/components/inventory/StockManager';
import AppointmentReminder from '@/components/appointments/AppointmentReminder';
import WeeklyReportEntryCard from '@/features/ai-report/components/WeeklyReportEntryCard';
import { useAuthStore } from '@/store/authStore';
import { useMedicationStore } from '@/store/medicationStore';
import { useLogStore } from '@/store/logStore';
import { useAppointmentStore } from '@/store/appointmentStore';
import { useUIStore } from '@/store/uiStore';
import { useDefaultData, getDefaultMedications, getDefaultLogs } from '@/hooks/useDefaultData';
import { format, isSameDay, isFuture, startOfDay } from 'date-fns';
import { scheduleKeyMatches, toLocalDateKey } from '@/lib/dateTime';
import { loadNotifications, syncNotifications } from '@/api/notifications';
import { requireSupabase } from '@/integrations/supabase/client';

/**
 * 今日用药看板（首页）
 * 用户打开APP的第一屏核心页面
 * 根据日期智能显示当天需要服用的药物
 */
const Dashboard = () => {
  const navigate = useNavigate();
  const { user, authStatus } = useAuthStore();
  const { medications, loadLocalMedications, updateMedication, isLoading: medLoading } = useMedicationStore();
  const { 
    todayLogs, 
    loadLocalLogs, 
    checkIn, 
    skipMedication, 
    getTodayStats,
    isLoading: logLoading 
  } = useLogStore();
  const { appointments, loadLocalAppointments } = useAppointmentStore();
  const { setActiveTab, setPageTitle } = useUIStore();
  const { hasRealData, markHasRealData } = useDefaultData('dashboard');

  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [displayMedications, setDisplayMedications] = useState([]);
  const [displayLogs, setDisplayLogs] = useState([]);
  
  // 打卡弹窗状态
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    const refreshUnreadCount = () => loadNotifications(user.id)
      .then((items) => setUnreadNotificationCount(items.filter((item) => !item.read_at).length))
      .catch(() => {});
    syncNotifications().catch(() => {}).finally(refreshUnreadCount);
    const channel = requireSupabase().channel(`dashboard-notifications:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${user.id}` }, refreshUnreadCount)
      .subscribe();
    return () => requireSupabase().removeChannel(channel);
  }, [user?.id]);

  // 库存管理器状态
  const [stockManagerOpen, setStockManagerOpen] = useState(false);
  const [selectedStockMed, setSelectedStockMed] = useState(null);

  // 关键修复：使用ref防止重复提交
  const isProcessingRef = useRef(false);

  // 关键修复：判断当前查看的日期是否是今天
  const isToday = useMemo(() => isSameDay(currentDate, new Date()), [currentDate]);
  
  // 关键修复：判断当前查看的日期是否是未来日期
  const isFutureDate = useMemo(() => {
    const today = startOfDay(new Date());
    const viewDate = startOfDay(currentDate);
    return viewDate > today;
  }, [currentDate]);

  // 设置页面标题
  useEffect(() => {
    setPageTitle(isToday ? '今日用药' : format(currentDate, 'MM月dd日'));
    setActiveTab('home');
  }, [setPageTitle, setActiveTab, isToday, currentDate]);

  // 检查登录状态
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      navigate('/login');
    }
  }, [authStatus, navigate]);

  // 加载数据
  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user, currentDate]);

  // 合并默认数据和真实数据
  useEffect(() => {
    const realMeds = medications.filter(m => !m.is_demo && m.status === 'active');
    const hasAnyRealMeds = realMeds.length > 0;
    
    if (hasAnyRealMeds && !hasRealData) {
      markHasRealData();
    }
    
    const dateStr = toLocalDateKey(currentDate);
    
    // 只在使用今天日期且没有真实数据时显示默认数据
    if (isToday && !hasRealData && medications.filter(m => m.status === 'active').length === 0) {
      setDisplayMedications(getDefaultMedications(user?.id || 'guest'));
      setDisplayLogs(getDefaultLogs(user?.id || 'guest', dateStr));
    } else {
      setDisplayMedications(medications);
      setDisplayLogs(todayLogs);
    }
  }, [medications, todayLogs, hasRealData, user, isToday, currentDate, markHasRealData]);

  const loadData = async () => {
    if (!user?.id) return;
    
    setIsSyncing(true);
    try {
      // 加载用药计划
      await loadLocalMedications(user.id);
      
      // 加载当日打卡记录 - 关键：确保日期正确
      const dateStr = toLocalDateKey(currentDate);
      await loadLocalLogs(user.id, dateStr);
      
      // 加载复诊预约
      await loadLocalAppointments(user.id);
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error('数据加载失败，请稍后重试');
    } finally {
      setIsSyncing(false);
    }
  };

  // 获取今日统计 - 基于实际服药记录计算
  const stats = useMemo(() => {
    const logsToUse = displayLogs.length > 0 ? displayLogs : todayLogs;
    const total = logsToUse.length;
    const taken = logsToUse.filter(l => l.status === 'taken').length;
    const skipped = logsToUse.filter(l => l.status === 'skipped').length;
    const pending = total - taken - skipped;
    
    return { 
      total, 
      taken, 
      skipped, 
      pending, 
      completionRate: total > 0 ? Math.round((taken / total) * 100) : 0 
    };
  }, [displayLogs, todayLogs]);

  // 关键修复：打开打卡弹窗前校验日期
  const handleCheckIn = useCallback((medication, time) => {
    // 禁止未来日期打卡
    if (isFutureDate) {
      toast.error('不能提前打卡哦，请在服药当天再确认');
      return;
    }
    
    // 禁止过去日期打卡（这里可以放宽，允许补打卡，但要有提示）
    if (!isToday && !isFutureDate) {
      // 允许补打卡，但显示提示
      toast.info('您正在为过去的日期补打卡');
    }
    
    // 示例数据提示
    if (medication.is_demo) {
      toast.info('这是示例药物，请先添加真实用药计划');
      return;
    }
    
    setSelectedMedication(medication);
    setSelectedTime(time);
    setCheckInModalOpen(true);
  }, [isFutureDate, isToday]);

  // 确认打卡 - 关键修复：确保状态即时更新
  const handleConfirmCheckIn = useCallback(async (checkInData) => {
    if (!selectedMedication || !user?.id) return;
    
    // 防止重复提交
    if (isProcessingRef.current) {
      console.log('[Dashboard] 正在处理中，忽略重复提交');
      return;
    }
    
    // 再次校验日期，防止绕过前端
    if (isFutureDate) {
      toast.error('不能提前打卡');
      setCheckInModalOpen(false);
      return;
    }
    
    // 示例数据检查
    if (selectedMedication.is_demo) {
      toast.info('示例数据无法打卡，请先添加真实用药计划');
      setCheckInModalOpen(false);
      return;
    }
    
    isProcessingRef.current = true;
    setIsCheckingIn(true);
    
    try {
      const dateStr = toLocalDateKey(currentDate);
      const scheduledTime = selectedTime || selectedMedication.reminder_times?.[0] || '08:00';
      
      // 关键修复：检查是否已经打过卡（使用最新的todayLogs）
      const existingLog = todayLogs.find(l =>
        l.status === 'taken' &&
        scheduleKeyMatches(l, {
          medicationId: selectedMedication.id,
          scheduledDate: dateStr,
          scheduledTime,
        })
      );
      
      if (existingLog) {
        toast.info('该时段已经打卡过了');
        setCheckInModalOpen(false);
        setSelectedMedication(null);
        setSelectedTime(null);
        setIsCheckingIn(false);
        isProcessingRef.current = false;
        return;
      }

      const result = await checkIn(user.id, selectedMedication.id, {
        scheduled_date: dateStr,
        scheduled_time: scheduledTime,
        taken_at: checkInData.taken_at,
        feeling_score: checkInData.feeling_score,
        note: checkInData.note,
      });

      if (result.success) {
        toast.success(`${selectedMedication.name} 打卡成功`);
        markHasRealData();
        
        // 关键修复：打卡成功后立即重新加载数据以确保UI同步
        await loadLocalLogs(user.id, dateStr);
        
        // 自动扣减库存
        if (selectedMedication.stock_quantity > 0) {
          const dosage = parseFloat(selectedMedication.dosage) || 1;
          const newStock = Math.max(0, selectedMedication.stock_quantity - dosage);
          await updateMedication(selectedMedication.id, { stock_quantity: newStock });
          
          // 重新加载药物数据以更新库存显示
          await loadLocalMedications(user.id);
          
          // 检查库存状态
          const freqType = selectedMedication.frequency_type;
          const freqConfig = selectedMedication.frequency_config || {};
          let dailyConsumption = dosage;
          
          switch (freqType) {
            case 'daily':
              dailyConsumption = dosage * (freqConfig.dailyTimes || 1);
              break;
            case 'weekly':
              const daysPerWeek = freqConfig.weeklyDays?.length || 1;
              dailyConsumption = (dosage * daysPerWeek) / 7;
              break;
            case 'interval':
              const interval = freqConfig.intervalDays || 2;
              dailyConsumption = dosage / interval;
              break;
            default:
              dailyConsumption = dosage;
          }
          
          const daysRemaining = Math.floor(newStock / dailyConsumption);
          const threshold = selectedMedication.low_stock_threshold || 7;
          
          if (daysRemaining <= threshold && daysRemaining > 0) {
            toast.warning(`${selectedMedication.name} 库存不足${threshold}天，请及时补充`, {
              action: {
                label: '去补货',
                onClick: () => toast.info('补货记录功能后续接入')
              }
            });
          } else if (daysRemaining <= 0) {
            toast.error(`${selectedMedication.name} 库存已耗尽，请尽快补货`, {
              action: {
                label: '去补货',
                onClick: () => toast.info('补货记录功能后续接入')
              }
            });
          }
        }
        
        setCheckInModalOpen(false);
        setSelectedMedication(null);
        setSelectedTime(null);
      } else {
        toast.error(result.error || '打卡失败');
      }
    } catch (error) {
      toast.error('打卡失败，请重试');
    } finally {
      setIsCheckingIn(false);
      isProcessingRef.current = false;
    }
  }, [selectedMedication, selectedTime, user, currentDate, todayLogs, isFutureDate, checkIn, updateMedication, loadLocalLogs, loadLocalMedications, markHasRealData]);

  // 处理跳过
  const handleSkip = useCallback(async (medication, time) => {
    // 禁止未来日期跳过
    if (isFutureDate) {
      toast.error('不能提前操作');
      return;
    }
    
    // 示例数据检查
    if (medication.is_demo) {
      toast.info('示例数据无法操作，请先添加真实用药计划');
      return;
    }
    
    try {
      const dateStr = toLocalDateKey(currentDate);
      const result = await skipMedication(user.id, medication.id, {
        scheduled_date: dateStr,
        scheduled_time: time || medication.reminder_times?.[0] || '08:00',
        reason: '用户跳过',
      });

      if (result.success) {
        toast.success(`已跳过 ${medication.name}`);
        // 关键修复：跳过后立即重新加载数据
        await loadLocalLogs(user.id, dateStr);
      } else {
        toast.error(result.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败，请重试');
    }
  }, [isFutureDate, user, currentDate, skipMedication, loadLocalLogs]);

  // 处理编辑
  const handleEdit = useCallback((medication) => {
    if (medication.is_demo) {
      toast.info('示例数据无法编辑，请先添加真实用药计划');
      return;
    }
    navigate(`/medications/edit/${medication.id}`);
  }, [navigate]);

  // 处理删除
  const handleDelete = useCallback((medication) => {
    if (medication.is_demo) {
      toast.info('示例数据无法删除');
      return;
    }
    toast.info('请前往用药计划页面删除');
  }, []);

  // 打开库存管理器
  const handleAddStock = useCallback((medication) => {
    setSelectedStockMed(medication);
    setStockManagerOpen(true);
  }, []);

  // 更新库存
  const handleUpdateStock = useCallback(async (updatedMed) => {
    const result = await updateMedication(updatedMed.id, {
      stock_quantity: updatedMed.stock_quantity
    });

    if (result.success) {
      toast.success(`${updatedMed.name} 库存已更新`);
      setStockManagerOpen(false);
      setSelectedStockMed(null);
      // 关键修复：更新后重新加载数据
      await loadLocalMedications(user.id);
    } else {
      toast.error('更新失败，请重试');
    }
  }, [updateMedication, loadLocalMedications, user]);

  // 处理补货入口
  const handleRefill = () => {
    toast.info('补货记录功能后续接入', {
      description: '本阶段仅做库存预警和手动库存管理'
    });
  };

  // 计算进度百分比
  const progressPercentage = stats.total > 0 
    ? Math.round((stats.taken / stats.total) * 100) 
    : 0;

  // 判断是否显示空状态 - 需要过滤掉不在当天显示的药物
  const activeMedications = displayMedications.filter(m => {
    if (m.status !== 'active') return false;
    
    // 检查日期范围
    const targetDate = new Date(currentDate);
    if (m.start_date) {
      const startDate = new Date(m.start_date);
      if (targetDate < startDate) return false;
    }
    if (m.end_date) {
      const endDate = new Date(m.end_date);
      if (targetDate > endDate) return false;
    }
    
    // 根据频次类型判断是否当天需要服用
    const dayOfWeek = targetDate.getDay();
    const freqType = m.frequency_type;
    const freqConfig = m.frequency_config || {};
    
    switch (freqType) {
      case 'weekly':
        const weeklyDays = freqConfig.weeklyDays || [];
        return weeklyDays.includes(dayOfWeek);
      case 'interval':
        if (!m.start_date) return true;
        const startDate = new Date(m.start_date);
        const diffTime = targetDate.getTime() - startDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const interval = freqConfig.intervalDays || 2;
        return diffDays % interval === 0;
      case 'custom':
        // 自定义频次每天显示在按需服用分组
        return true;
      case 'daily':
      default:
        return true;
    }
  });
  
  // 计算今日应服药总次数（考虑一天多次）
  const todayTotalDoses = useMemo(() => {
    return activeMedications.reduce((total, med) => {
      // 自定义频次按1次计算（按需服用）
      if (med.frequency_type === 'custom') {
        return total + 1;
      }
      const reminderTimes = med.reminder_times || ['08:00'];
      return total + reminderTimes.length;
    }, 0);
  }, [activeMedications]);
  
  const showEmptyState = !medLoading && activeMedications.length === 0;

  // 未来日期提示文字
  const getDateStatusText = () => {
    if (isFutureDate) {
      return '这是未来的日期，可以提前查看用药计划，但不能打卡';
    }
    if (!isToday) {
      return '这是过去的日期，可以补打卡或查看记录';
    }
    return null;
  };

  // 获取低库存药品数量
  const lowStockCount = useMemo(() => {
    return medications.filter(m => {
      if (m.status !== 'active' || m.frequency_type === 'custom') return false;
      const stock = m.stock_quantity || 0;
      const threshold = m.low_stock_threshold || 7;
      const dosage = parseFloat(m.dosage) || 1;
      const daysRemaining = Math.floor(stock / dosage);
      return daysRemaining <= threshold && daysRemaining > 0;
    }).length;
  }, [medications]);

  // 获取告急库存数量
  const criticalStockCount = useMemo(() => {
    return medications.filter(m => {
      if (m.status !== 'active' || m.frequency_type === 'custom') return false;
      const stock = m.stock_quantity || 0;
      const dosage = parseFloat(m.dosage) || 1;
      const daysRemaining = Math.floor(stock / dosage);
      return daysRemaining <= 3;
    }).length;
  }, [medications]);

  // 是否有示例数据
  const hasDemoData = activeMedications.some(m => m.is_demo);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 顶部区域 */}
      <div className="bg-white px-4 pt-4 pb-6 rounded-b-3xl shadow-sm">
        <div className="relative">
        <button aria-label="站内通知" onClick={() => navigate('/notifications')} className="absolute right-1 top-1 z-10 rounded-full p-2 text-gray-600 hover:bg-gray-100">
          <Bell className="h-5 w-5" />
          {unreadNotificationCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] leading-4 text-white">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}
        </button>
        {/* 日期导航 */}
        <DateNavigator 
          currentDate={currentDate} 
          onDateChange={setCurrentDate} 
        />
        </div>

        {/* 日期状态提示 */}
        {getDateStatusText() && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${
            isFutureDate ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{getDateStatusText()}</span>
            </div>
          </div>
        )}

        {/* 示例数据提示 */}
        {hasDemoData && (
          <div className="mt-3 p-3 rounded-lg text-sm bg-amber-50 text-amber-700 border border-amber-200">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5" />
              <div>
                <p className="font-medium">示例数据展示</p>
                <p className="text-amber-600 text-xs mt-1">点击下方"添加药物"创建您的真实用药计划</p>
              </div>
            </div>
          </div>
        )}

        {/* 进度统计卡片 */}
        <Card className={`mt-4 p-6 border-green-100 ${
          isFutureDate ? 'bg-gray-50 opacity-75' : 'bg-gradient-to-br from-green-50 to-emerald-50'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {isToday ? '今日服药进度' : '当日服药进度'}
              </h2>
              <p className="text-sm text-gray-500">
                {stats.total > 0 
                  ? `已完成 ${stats.taken}/${stats.total} 次服药`
                  : `今日共需服药 ${todayTotalDoses} 次`}
              </p>
              {stats.skipped > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  已跳过 {stats.skipped} 次
                </p>
              )}
            </div>
            
            <ProgressRing 
              progress={progressPercentage}
              total={stats.total || todayTotalDoses}
              completed={stats.taken}
              size={100}
              strokeWidth={8}
            />
          </div>
        </Card>
      </div>

      {/* 在线加载状态提示 */}
      {isSyncing && (
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-gray-500 bg-gray-50">
          <Loader2 className="w-3 h-3 animate-spin" />
          加载在线数据中...
        </div>
      )}

      {/* 复诊提醒 */}
      <div className="px-4 mt-4">
        <AppointmentReminder 
          appointments={appointments}
          onViewAll={() => navigate('/appointments')}
        />
      </div>

      <div className="px-4 mt-4">
        <WeeklyReportEntryCard />
      </div>

      {/* 库存预警和补货入口 */}
      {(lowStockCount > 0 || criticalStockCount > 0) && (
        <div className="px-4 mt-4">
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <RefreshCw className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-amber-900 mb-1">
                    药品库存预警
                  </h3>
                  <p className="text-sm text-amber-700 mb-3">
                    {criticalStockCount > 0 && `${criticalStockCount}种药品库存告急`}
                    {criticalStockCount > 0 && lowStockCount > 0 && '，'}
                    {lowStockCount > 0 && `${lowStockCount}种药品库存不足`}
                    ，建议及时补货
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={handleRefill}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      记录补货
                    </Button>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="border-amber-300 text-amber-700 hover:bg-amber-100"
                      onClick={() => navigate('/inventory')}
                    >
                      查看库存
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 原有的库存预警组件（当没有告急但有不充足时显示） */}
      {criticalStockCount === 0 && lowStockCount === 0 && (
        <div className="px-4 mt-4">
          <StockAlert 
            medications={medications}
            onViewAll={() => navigate('/inventory')}
            onAddStock={handleAddStock}
          />
        </div>
      )}

      {/* 服药记录快捷入口 */}
      <div className="px-4 mt-4">
        <Card 
          className="p-4 bg-white border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/logs')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">服药记录</h3>
                <p className="text-xs text-gray-500">查看月历和打卡历史</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </Card>
      </div>

      {/* 主内容区域 */}
      <div className="px-4 py-4">
        {medLoading ? (
          // 加载状态
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-3" />
            <p className="text-gray-500">加载用药计划中...</p>
          </div>
        ) : showEmptyState ? (
          // 空状态
          <Card className="p-8 text-center border-dashed border-2">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {medications.filter(m => m.status === 'active').length > 0 
                ? '当日无需服药' 
                : '还没有用药计划'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {medications.filter(m => m.status === 'active').length > 0 
                ? '根据您的用药计划，这一天没有需要服用的药物'
                : '添加您的第一种药物，开始规律用药管理'}
            </p>
            {medications.filter(m => m.status === 'active').length === 0 && (
              <Button 
                onClick={() => navigate('/medications/add')}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                添加药物
              </Button>
            )}
          </Card>
        ) : (
          // 时段分组展示 - 传递日期状态用于控制交互
          <TimeGroup
            medications={activeMedications}
            logs={displayLogs.length > 0 ? displayLogs : todayLogs}
            currentDate={currentDate}
            onCheckIn={handleCheckIn}
            onSkip={handleSkip}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isFutureDate={isFutureDate}
            isToday={isToday}
          />
        )}
      </div>

      {/* 悬浮添加按钮 - 只在今天显示 */}
      {!showEmptyState && isToday && (
        <Button
          className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 shadow-lg z-40"
          onClick={() => navigate('/medications/add')}
        >
          <Plus className="w-6 h-6" />
        </Button>
      )}

      {/* 打卡弹窗 */}
      <CheckInModal
        isOpen={checkInModalOpen}
        onClose={() => {
          setCheckInModalOpen(false);
          setSelectedMedication(null);
          setSelectedTime(null);
        }}
        medication={selectedMedication}
        onConfirm={handleConfirmCheckIn}
        isLoading={isCheckingIn}
      />

      {/* 库存管理器 */}
      <StockManager
        isOpen={stockManagerOpen}
        onClose={() => {
          setStockManagerOpen(false);
          setSelectedStockMed(null);
        }}
        medication={selectedStockMed}
        onUpdate={handleUpdateStock}
      />
    </div>
  );
};

export default Dashboard;
