import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { 
  Sun, 
  Sunrise, 
  Sunset, 
  Moon,
  Clock,
  Settings2
} from 'lucide-react';
import MedicationCard from './MedicationCard';
import { scheduleKeyMatches, toLocalDateKey } from '@/lib/dateTime';

/**
 * 时段分组组件
 * 按早/中/晚/按需服用分组展示药物
 * 
 * 修复：改为四个时段：早晨、中午、晚上、按需服用
 * 修复：自定义药物放入按需服用栏目
 * 修复：一天多次服药时显示正确的时间
 */

const TimeGroup = ({ 
  medications, 
  logs, 
  currentDate,
  onCheckIn, 
  onSkip, 
  onEdit, 
  onDelete,
  isFutureDate = false,
  isToday = true
}) => {
  // 时段定义 - 改为四个时段
  const timeSlots = [
    { 
      id: 'morning', 
      label: '早晨', 
      icon: Sunrise, 
      timeRange: [5, 11], // 5点-11点
      color: 'text-orange-500',
      bgColor: 'bg-orange-50'
    },
    { 
      id: 'noon', 
      label: '中午', 
      icon: Sun, 
      timeRange: [12, 14], // 12点-14点
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    { 
      id: 'evening', 
      label: '晚上', 
      icon: Sunset, 
      timeRange: [17, 21], // 17点-21点
      color: 'text-purple-500',
      bgColor: 'bg-purple-50'
    },
    { 
      id: 'asNeeded', 
      label: '按需服用', 
      icon: Settings2, 
      timeRange: [], // 自定义时段，不按时间
      color: 'text-gray-500',
      bgColor: 'bg-gray-50'
    }
  ];

  // 关键修复：将药物按提醒时间展开为多个服药项
  const expandMedicationsByTime = (meds) => {
    const expanded = [];
    
    meds.forEach(med => {
      // 自定义频次的药物放入按需服用
      if (med.frequency_type === 'custom') {
        // 查找对应的打卡记录（按日期匹配）
        const dateStr = toLocalDateKey(currentDate || new Date());
        const log = logs.find(l => 
          l.medication_id === med.id && 
          l.scheduled_date === dateStr
        );
        
        expanded.push({
          ...med,
          _instanceId: `${med.id}_custom`,
          _time: null, // 按需服用无固定时间
          _slot: timeSlots.find(s => s.id === 'asNeeded'),
          _log: log
        });
        return;
      }
      
      // 获取提醒时间列表
      const reminderTimes = med.reminder_times || ['08:00'];
      
      // 如果是一天多次，为每个时间创建一个条目
      reminderTimes.forEach((time, index) => {
        const hour = parseInt(time.split(':')[0], 10);
        
        // 找到对应的时段 - 根据时间判断
        let slot = timeSlots.find(s => 
          s.timeRange.length > 0 && hour >= s.timeRange[0] && hour <= s.timeRange[1]
        );
        
        // 如果不在上述时段，根据时间判断放入最合适的时段
        if (!slot) {
          if (hour >= 5 && hour < 12) {
            slot = timeSlots.find(s => s.id === 'morning');
          } else if (hour >= 12 && hour < 15) {
            slot = timeSlots.find(s => s.id === 'noon');
          } else if (hour >= 15 && hour < 22) {
            slot = timeSlots.find(s => s.id === 'evening');
          } else {
            // 深夜时段（22点-4点）也归入按需服用
            slot = timeSlots.find(s => s.id === 'asNeeded');
          }
        }
        
        // 查找对应的打卡记录 - 关键修复：精确匹配时间
        const dateStr = toLocalDateKey(currentDate || new Date());
        const log = logs.find(l =>
          scheduleKeyMatches(l, {
            medicationId: med.id,
            scheduledDate: dateStr,
            scheduledTime: time,
          })
        );
        
        expanded.push({
          ...med,
          _instanceId: `${med.id}_${time}`, // 唯一标识
          _time: time, // 保存具体的时间
          _slot: slot,
          _log: log
        });
      });
    });
    
    return expanded;
  };

  // 按时段分组药物
  const groupedMedications = useMemo(() => {
    const expanded = expandMedicationsByTime(medications);
    const groups = {};
    
    timeSlots.forEach(slot => {
      groups[slot.id] = expanded.filter(med => med._slot.id === slot.id);
    });
    
    return groups;
  }, [medications, logs, currentDate]);

  // 检查是否有药物
  const hasMedications = Object.values(groupedMedications).some(group => group.length > 0);

  if (!hasMedications) {
    return (
      <Card className="p-8 text-center border-dashed border-2">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          当日无需服药
        </h3>
        <p className="text-sm text-gray-500">
          根据您的用药计划，这一天没有需要服用的药物
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {timeSlots.map((slot) => {
        const slotMeds = groupedMedications[slot.id] || [];
        if (slotMeds.length === 0) return null;

        const Icon = slot.icon;

        return (
          <div key={slot.id} className="space-y-3">
            {/* 时段标题 */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${slot.bgColor}`}>
              <Icon className={`w-5 h-5 ${slot.color}`} />
              <span className={`font-medium ${slot.color}`}>{slot.label}</span>
              <span className="text-sm text-gray-500">
                ({slotMeds.length}种药物)
              </span>
            </div>

            {/* 药物列表 */}
            <div className="space-y-3">
              {slotMeds.map((med) => (
                <MedicationCard
                  key={med._instanceId}
                  medication={med}
                  log={med._log}
                  onCheckIn={() => onCheckIn?.(med, med._time)}
                  onSkip={() => onSkip?.(med, med._time)}
                  onEdit={() => onEdit?.(med)}
                  onDelete={() => onDelete?.(med)}
                  isFutureDate={isFutureDate}
                  isToday={isToday}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TimeGroup;
