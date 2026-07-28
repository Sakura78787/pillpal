import { useMemo } from 'react';
import { 
  Heart, 
  Droplets, 
  Scale, 
  Clock,
  Trash2,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 最近记录列表组件
 * 展示最近7天的健康记录，简化版设计
 */
const RecentList = ({ 
  records = [], 
  onDelete,
  maxItems = 10
}) => {
  // 按日期分组
  const groupedRecords = useMemo(() => {
    const groups = {};
    
    records.forEach(record => {
      const dateKey = record.recorded_at.split('T')[0];
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(record);
    });
    
    // 转换为数组并排序
    return Object.entries(groups)
      .sort(([a], [b]) => new Date(b) - new Date(a))
      .slice(0, 7)
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => 
          new Date(b.recorded_at) - new Date(a.recorded_at)
        )
      }));
  }, [records]);

  // 获取类型图标和颜色
  const getTypeConfig = (type) => {
    const configs = {
      blood_pressure: {
        icon: Heart,
        color: 'rose',
        bgColor: 'bg-rose-50',
        textColor: 'text-rose-700',
        label: '血压'
      },
      blood_sugar: {
        icon: Droplets,
        color: 'blue',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        label: '血糖'
      },
      weight: {
        icon: Scale,
        color: 'emerald',
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-700',
        label: '体重'
      }
    };
    return configs[type] || configs.weight;
  };

  // 格式化数值显示
  const formatValue = (record) => {
    const { record_type, values } = record;
    
    switch (record_type) {
      case 'blood_pressure':
        return `${values.systolic}/${values.diastolic} mmHg`;
      case 'blood_sugar':
        const timing = values.timing === 'fasting' ? '空腹' : 
                      values.timing === 'post_meal' ? '餐后' : '随机';
        return `${values.value} mmol/L (${timing})`;
      case 'weight':
        return `${values.value} kg`;
      default:
        return '--';
    }
  };

  // 获取趋势（与前一天同类型记录对比）
  const getTrend = (record, allRecords) => {
    const recordDate = new Date(record.recorded_at);
    const sameTypeRecords = allRecords
      .filter(r => r.record_type === record.record_type && r.id !== record.id)
      .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
    
    if (sameTypeRecords.length === 0) return null;
    
    const previous = sameTypeRecords.find(r => 
      new Date(r.recorded_at) < recordDate
    );
    
    if (!previous) return null;
    
    let currentVal, previousVal;
    
    if (record.record_type === 'blood_pressure') {
      currentVal = record.values.systolic;
      previousVal = previous.values.systolic;
    } else {
      currentVal = record.values.value;
      previousVal = previous.values.value;
    }
    
    if (currentVal > previousVal) return 'up';
    if (currentVal < previousVal) return 'down';
    return 'stable';
  };

  // 空状态
  if (groupedRecords.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">暂无健康记录</h3>
        <p className="text-sm text-gray-500">点击上方按钮开始记录您的健康数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupedRecords.map(({ date, items }) => (
        <div key={date}>
          {/* 日期分隔 */}
          <div className="flex items-center gap-3 mb-3">
            <h4 className="text-sm font-medium text-gray-500">
              {format(parseISO(date), 'MM月dd日 EEEE', { locale: zhCN })}
            </h4>
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">{items.length} 条记录</span>
          </div>
          
          {/* 记录列表 */}
          <div className="space-y-2">
            {items.slice(0, maxItems).map((record) => {
              const config = getTypeConfig(record.record_type);
              const Icon = config.icon;
              const trend = getTrend(record, records);
              
              return (
                <Card 
                  key={record.id}
                  className="p-3 flex items-center gap-3 hover:shadow-sm transition-shadow"
                >
                  {/* 图标 */}
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    config.bgColor
                  )}>
                    <Icon className={cn("w-5 h-5", config.textColor)} />
                  </div>
                  
                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {formatValue(record)}
                      </span>
                      {trend && (
                        <span className={cn(
                          "text-xs",
                          trend === 'up' ? 'text-red-500' : 
                          trend === 'down' ? 'text-green-500' : 'text-gray-400'
                        )}>
                          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {format(parseISO(record.recorded_at), 'HH:mm')}
                      {record.note && (
                        <span className="truncate">· {record.note}</span>
                      )}
                    </div>
                  </div>
                  
                  {/* 删除按钮 */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-red-500"
                    onClick={() => onDelete?.(record)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
      
      {/* 提示 */}
      <p className="text-xs text-gray-400 text-center pt-4">
        仅显示最近7天的记录，完整数据请导出查看
      </p>
    </div>
  );
};

export default RecentList;
