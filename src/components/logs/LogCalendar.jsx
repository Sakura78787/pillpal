import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  getYear,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 打卡日历组件
 * 展示用户服药打卡情况，支持按月查看
 * 
 * 修复：2026年法定节假日和调休安排（根据国务院官方安排）
 */

// 2026年中国法定节假日配置（根据国务院官方安排）
const HOLIDAYS_2026 = {
  // 元旦：2026年1月1日（周四）放假
  '2026-01-01': { name: '元旦', type: 'holiday' },
  
  // 春节：2026年2月17日(除夕/周二)至23日(初六/周一)放假调休，共7天
  // 2月14日(周六)、2月15日(周日)上班
  '2026-02-17': { name: '除夕', type: 'holiday' },
  '2026-02-18': { name: '春节', type: 'holiday' },
  '2026-02-19': { name: '初二', type: 'holiday' },
  '2026-02-20': { name: '初三', type: 'holiday' },
  '2026-02-21': { name: '初四', type: 'holiday' },
  '2026-02-22': { name: '初五', type: 'holiday' },
  '2026-02-23': { name: '初六', type: 'holiday' },
  
  // 清明节：2026年4月4日(周六)至6日(周一)放假，共3天（无调休）
  '2026-04-04': { name: '清明', type: 'holiday' },
  '2026-04-05': { name: '清明', type: 'holiday' },
  '2026-04-06': { name: '清明', type: 'holiday' },
  
  // 劳动节：2026年5月1日(周五)至3日(周日)放假，共3天（无调休）
  '2026-05-01': { name: '劳动', type: 'holiday' },
  '2026-05-02': { name: '劳动', type: 'holiday' },
  '2026-05-03': { name: '劳动', type: 'holiday' },
  
  // 端午节：2026年6月19日(周五)至21日(周日)放假，共3天（无调休）
  '2026-06-19': { name: '端午', type: 'holiday' },
  '2026-06-20': { name: '端午', type: 'holiday' },
  '2026-06-21': { name: '端午', type: 'holiday' },
  
  // 中秋节：2026年9月25日(周五)至27日(周日)放假，共3天（无调休）
  '2026-09-25': { name: '中秋', type: 'holiday' },
  '2026-09-26': { name: '中秋', type: 'holiday' },
  '2026-09-27': { name: '中秋', type: 'holiday' },
  
  // 国庆节：2026年10月1日(周四)至7日(周三)放假调休，共7天
  // 10月10日(周六)上班
  '2026-10-01': { name: '国庆', type: 'holiday' },
  '2026-10-02': { name: '国庆', type: 'holiday' },
  '2026-10-03': { name: '国庆', type: 'holiday' },
  '2026-10-04': { name: '国庆', type: 'holiday' },
  '2026-10-05': { name: '国庆', type: 'holiday' },
  '2026-10-06': { name: '国庆', type: 'holiday' },
  '2026-10-07': { name: '国庆', type: 'holiday' },
};

// 调休上班日（需要上班的周末）
const WORKDAYS_2026 = {
  // 春节调休：2月14日(周六)、2月15日(周日)上班
  '2026-02-14': { name: '班', type: 'workday' },
  '2026-02-15': { name: '班', type: 'workday' },
  
  // 国庆节调休：10月10日(周六)上班
  '2026-10-10': { name: '班', type: 'workday' },
};

const LogCalendar = ({ logs = [], onDateClick, selectedDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 获取日历数据
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    
    const days = [];
    let day = start;
    
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    
    return days;
  }, [currentMonth]);

  // 按日期分组日志
  const logsByDate = useMemo(() => {
    const grouped = {};
    logs.forEach(log => {
      const dateKey = log.scheduled_date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(log);
    });
    return grouped;
  }, [logs]);

  // 获取某天的状态
  const getDayStatus = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayLogs = logsByDate[dateStr] || [];
    
    if (dayLogs.length === 0) return 'empty';
    
    const total = dayLogs.length;
    const taken = dayLogs.filter(l => l.status === 'taken').length;
    const skipped = dayLogs.filter(l => l.status === 'skipped').length;
    
    if (taken === total) return 'completed';
    if (taken > 0) return 'partial';
    if (skipped === total) return 'skipped';
    return 'pending';
  };

  // 获取日期对应的节假日信息
  const getHolidayInfo = (date) => {
    const year = getYear(date);
    if (year !== 2026) return null;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    return HOLIDAYS_2026[dateStr] || WORKDAYS_2026[dateStr] || null;
  };

  // 获取状态样式
  const getStatusStyles = (status, isHoliday, isWorkday) => {
    // 节假日特殊样式
    if (isHoliday) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    // 调休上班日样式
    if (isWorkday) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'partial':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'skipped':
        return 'bg-gray-100 text-gray-500 border-gray-300';
      case 'pending':
        return 'bg-amber-50 text-amber-600 border-amber-200';
      default:
        return 'bg-white text-gray-400 border-gray-100';
    }
  };

  // 获取状态图标
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <Check className="w-3 h-3" />;
      case 'skipped':
        return <Minus className="w-3 h-3" />;
      default:
        return null;
    }
  };

  // 切换到上个月
  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  // 切换到下个月
  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // 处理日期点击
  const handleDateClick = (date) => {
    onDateClick?.(date);
  };

  // 星期标题
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  return (
    <Card className="p-4">
      {/* 月份导航 */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          className="h-8 w-8"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3 className="font-semibold text-gray-900">
          {format(currentMonth, 'yyyy年MM月', { locale: zhCN })}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          className="h-8 w-8"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* 星期标题 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={`text-center text-xs py-1 font-medium ${
              index >= 5 ? 'text-red-500' : 'text-gray-400'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, index) => {
          const status = getDayStatus(date);
          const isCurrentMonth = isSameMonth(date, currentMonth);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isTodayDate = isToday(date);
          
          // 获取节假日信息
          const holidayInfo = getHolidayInfo(date);
          const isHoliday = holidayInfo?.type === 'holiday';
          const isWorkday = holidayInfo?.type === 'workday';
          // 周末判断
          const dayOfWeek = date.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          return (
            <button
              key={index}
              onClick={() => handleDateClick(date)}
              className={cn(
                "aspect-square rounded-lg border flex flex-col items-center justify-center relative transition-all min-h-[44px]",
                getStatusStyles(status, isHoliday, isWorkday),
                !isCurrentMonth && "opacity-30",
                isSelected && "ring-2 ring-green-600 ring-offset-1",
                isTodayDate && !isSelected && "ring-1 ring-blue-400",
                "hover:scale-105 active:scale-95"
              )}
            >
              {/* 日期数字 */}
              <span className={cn(
                "text-sm font-medium",
                isTodayDate && "text-blue-600",
                isHoliday && "text-red-600",
                (isWeekend || isWorkday) && !isHoliday && "text-red-500"
              )}>
                {format(date, 'd')}
              </span>
              
              {/* 节假日名称或状态图标 */}
              {holidayInfo ? (
                <span className={cn(
                  "text-[10px] leading-none mt-0.5",
                  isHoliday ? "text-red-500 font-medium" : "text-blue-500"
                )}>
                  {holidayInfo.name}
                </span>
              ) : getStatusIcon(status) ? (
                <span className="absolute bottom-0.5">{getStatusIcon(status)}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="mt-4 pt-4 border-t flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
          <span className="text-gray-600">全部完成</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />
          <span className="text-gray-600">部分完成</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-100 border border-gray-300" />
          <span className="text-gray-600">已跳过</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-50 border border-red-200" />
          <span className="text-gray-600">节假日</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-50 border border-blue-200" />
          <span className="text-gray-600">调休上班</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-white border border-gray-200" />
          <span className="text-gray-600">无记录</span>
        </div>
      </div>
    </Card>
  );
};

export default LogCalendar;
