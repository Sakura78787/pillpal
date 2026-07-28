import { useMemo } from 'react';
import { 
  Heart, 
  Droplets, 
  Scale, 
  Activity,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 健康指标卡片组件
 * 展示血压、血糖、体重等核心指标的最新数值
 */
const HealthCards = ({ records = [] }) => {
  // 获取各类型的最新记录
  const latestRecords = useMemo(() => {
    const result = {
      blood_pressure: null,
      blood_sugar: null,
      weight: null
    };
    
    records.forEach(record => {
      if (result[record.record_type] === null || 
          new Date(record.recorded_at) > new Date(result[record.record_type].recorded_at)) {
        result[record.record_type] = record;
      }
    });
    
    return result;
  }, [records]);

  // 获取趋势（与上次记录对比）
  const getTrend = (recordType) => {
    const typeRecords = records
      .filter(r => r.record_type === recordType)
      .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
      .slice(0, 2);
    
    if (typeRecords.length < 2) return 'stable';
    
    const current = typeRecords[0];
    const previous = typeRecords[1];
    
    // 根据类型判断趋势
    if (recordType === 'blood_pressure') {
      const currentVal = current.values?.systolic || 0;
      const previousVal = previous.values?.systolic || 0;
      if (currentVal > previousVal) return 'up';
      if (currentVal < previousVal) return 'down';
    } else if (recordType === 'blood_sugar') {
      const currentVal = current.values?.value || 0;
      const previousVal = previous.values?.value || 0;
      if (currentVal > previousVal) return 'up';
      if (currentVal < previousVal) return 'down';
    } else if (recordType === 'weight') {
      const currentVal = current.values?.value || 0;
      const previousVal = previous.values?.value || 0;
      if (currentVal > previousVal) return 'up';
      if (currentVal < previousVal) return 'down';
    }
    
    return 'stable';
  };

  // 卡片配置
  const cardConfigs = [
    {
      type: 'blood_pressure',
      title: '血压',
      icon: Heart,
      color: 'rose',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      iconColor: 'text-rose-500',
      unit: 'mmHg',
      getDisplay: (record) => {
        if (!record) return '--/--';
        const { systolic, diastolic } = record.values || {};
        return `${systolic || '--'}/${diastolic || '--'}`;
      },
      getSubtitle: (record) => {
        if (!record) return '未记录';
        return `心率 ${record.values?.heart_rate || '--'} 次/分`;
      }
    },
    {
      type: 'blood_sugar',
      title: '血糖',
      icon: Droplets,
      color: 'blue',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-500',
      unit: 'mmol/L',
      getDisplay: (record) => {
        if (!record) return '--';
        return record.values?.value || '--';
      },
      getSubtitle: (record) => {
        if (!record) return '未记录';
        const timingMap = {
          fasting: '空腹',
          post_meal: '餐后2小时',
          random: '随机'
        };
        return timingMap[record.values?.timing] || '随机';
      }
    },
    {
      type: 'weight',
      title: '体重',
      icon: Scale,
      color: 'emerald',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      iconColor: 'text-emerald-500',
      unit: 'kg',
      getDisplay: (record) => {
        if (!record) return '--';
        return record.values?.value || '--';
      },
      getSubtitle: (record) => {
        if (!record) return '未记录';
        return `BMI ${record.values?.bmi || '--'}`;
      }
    }
  ];

  // 渲染趋势图标
  const renderTrend = (trend, color) => {
    const icons = {
      up: <TrendingUp className="w-4 h-4" />,
      down: <TrendingDown className="w-4 h-4" />,
      stable: <Minus className="w-4 h-4" />
    };
    
    const colors = {
      up: `text-${color}-500`,
      down: `text-${color}-500`,
      stable: 'text-gray-400'
    };
    
    return (
      <span className={cn(colors[trend], 'ml-2')}>
        {icons[trend]}
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cardConfigs.map((config) => {
        const record = latestRecords[config.type];
        const trend = getTrend(config.type);
        const Icon = config.icon;
        const hasRecord = !!record;
        
        return (
          <Card 
            key={config.type}
            className={cn(
              "p-4 border-2 transition-all hover:shadow-md",
              hasRecord ? config.borderColor : 'border-gray-100',
              hasRecord ? config.bgColor : 'bg-gray-50'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  hasRecord ? 'bg-white' : 'bg-gray-100',
                  config.iconColor
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{config.title}</h3>
                  <p className="text-xs text-gray-500">
                    {hasRecord 
                      ? format(new Date(record.recorded_at), 'MM月dd日 HH:mm', { locale: zhCN })
                      : '暂无记录'
                    }
                  </p>
                </div>
              </div>
              
              {hasRecord && renderTrend(trend, config.color)}
            </div>
            
            <div className="mt-4">
              <div className="flex items-baseline gap-1">
                <span className={cn(
                  "text-3xl font-bold",
                  hasRecord ? 'text-gray-900' : 'text-gray-400'
                )}>
                  {config.getDisplay(record)}
                </span>
                {hasRecord && (
                  <span className="text-sm text-gray-500">{config.unit}</span>
                )}
              </div>
              
              <p className={cn(
                "text-sm mt-1",
                hasRecord ? 'text-gray-600' : 'text-gray-400'
              )}>
                {config.getSubtitle(record)}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default HealthCards;
