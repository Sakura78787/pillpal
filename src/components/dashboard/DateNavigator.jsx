import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, isToday, isTomorrow, isYesterday, addDays, subDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 日期导航组件
 * 支持左右切换日期，显示"今天/昨天/明天"或具体日期
 */
const DateNavigator = ({ currentDate, onDateChange }) => {
  // 格式化日期显示
  const getDateLabel = (date) => {
    if (isToday(date)) return '今天';
    if (isTomorrow(date)) return '明天';
    if (isYesterday(date)) return '昨天';
    return format(date, 'MM月dd日', { locale: zhCN });
  };

  // 获取星期显示
  const getWeekdayLabel = (date) => {
    return format(date, 'EEEE', { locale: zhCN });
  };

  // 切换到前一天
  const handlePrevDay = () => {
    onDateChange(subDays(currentDate, 1));
  };

  // 切换到后一天
  const handleNextDay = () => {
    onDateChange(addDays(currentDate, 1));
  };

  // 回到今天
  const handleToday = () => {
    onDateChange(new Date());
  };

  return (
    <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      {/* 前一天按钮 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrevDay}
        className="w-10 h-10 rounded-full hover:bg-green-50 hover:text-green-600"
        aria-label="前一天"
      >
        <ChevronLeft className="w-5 h-5" />
      </Button>

      {/* 日期显示区域 */}
      <div className="flex flex-col items-center cursor-pointer" onClick={handleToday}>
        <span className="text-2xl font-bold text-gray-900">
          {getDateLabel(currentDate)}
        </span>
        <span className="text-sm text-gray-500 mt-0.5">
          {getWeekdayLabel(currentDate)}
        </span>
      </div>

      {/* 后一天按钮 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNextDay}
        className="w-10 h-10 rounded-full hover:bg-green-50 hover:text-green-600"
        aria-label="后一天"
      >
        <ChevronRight className="w-5 h-5" />
      </Button>
    </div>
  );
};

export default DateNavigator;
