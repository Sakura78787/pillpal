import { useMemo } from 'react';
import { Check, SkipForward, Clock, Pill } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

/**
 * 服药记录列表组件
 * 按日期分组展示服药记录
 */
const LogList = ({ logs = [], medications = [] }) => {
  // 按日期分组
  const groupedLogs = useMemo(() => {
    const grouped = {};
    
    // 按日期降序排序
    const sortedLogs = [...logs].sort((a, b) => {
      const dateA = new Date(`${a.scheduled_date}T${a.scheduled_time}`);
      const dateB = new Date(`${b.scheduled_date}T${b.scheduled_time}`);
      return dateB - dateA;
    });

    sortedLogs.forEach(log => {
      if (!grouped[log.scheduled_date]) {
        grouped[log.scheduled_date] = [];
      }
      grouped[log.scheduled_date].push(log);
    });

    return grouped;
  }, [logs]);

  // 获取药物名称
  const getMedicationName = (medicationId) => {
    const med = medications.find(m => m.id === medicationId);
    return med?.name || '未知药物';
  };

  // 获取药物剂量
  const getMedicationDosage = (medicationId) => {
    const med = medications.find(m => m.id === medicationId);
    return med ? `${med.dosage}${med.unit}` : '';
  };

  // 格式化日期显示
  const formatDate = (dateStr) => {
    const date = parseISO(dateStr);
    const today = new Date();
    const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
    
    if (isToday) {
      return '今天';
    }
    return format(date, 'MM月dd日 EEEE', { locale: zhCN });
  };

  // 获取状态样式
  const getStatusStyles = (status) => {
    switch (status) {
      case 'taken':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          icon: <Check className="w-4 h-4 text-green-600" />,
          text: '已服用',
          textColor: 'text-green-700',
        };
      case 'skipped':
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: <SkipForward className="w-4 h-4 text-gray-500" />,
          text: '已跳过',
          textColor: 'text-gray-600',
        };
      default:
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          icon: <Clock className="w-4 h-4 text-amber-500" />,
          text: '待服用',
          textColor: 'text-amber-700',
        };
    }
  };

  // 格式化时间
  const formatTime = (timeStr) => {
    return timeStr?.slice(0, 5) || '--:--';
  };

  // 格式化实际服用时间
  const formatTakenTime = (takenAt) => {
    if (!takenAt) return null;
    const date = new Date(takenAt);
    return format(date, 'HH:mm');
  };

  const dates = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Pill className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>暂无服药记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dates.map((date) => (
        <div key={date}>
          {/* 日期标题 */}
          <h4 className="text-sm font-medium text-gray-500 mb-2 px-1">
            {formatDate(date)}
          </h4>

          {/* 当日记录列表 */}
          <div className="space-y-2">
            {groupedLogs[date].map((log) => {
              const status = getStatusStyles(log.status);
              
              return (
                <Card
                  key={log.id}
                  className={cn(
                    "p-3 border-l-4",
                    status.bg,
                    status.border,
                    log.status === 'taken' ? 'border-l-green-500' : 
                    log.status === 'skipped' ? 'border-l-gray-400' : 'border-l-amber-400'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 truncate">
                          {getMedicationName(log.medication_id)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {getMedicationDosage(log.medication_id)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          计划 {formatTime(log.scheduled_time)}
                        </span>
                        {log.taken_at && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Check className="w-3 h-3" />
                            实际 {formatTakenTime(log.taken_at)}
                          </span>
                        )}
                      </div>

                      {log.note && (
                        <p className="text-xs text-gray-400 mt-1 italic">
                          备注: {log.note}
                        </p>
                      )}
                    </div>

                    {/* 状态标识 */}
                    <div className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                      status.bg,
                      status.textColor
                    )}>
                      {status.icon}
                      {status.text}
                    </div>
                  </div>

                  {log.skip_reason && (
                    <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                      跳过原因: {log.skip_reason}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LogList;
