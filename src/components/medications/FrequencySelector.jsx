import { useState, useEffect, useCallback } from 'react';

import { Card } from '@/components/ui/card';

import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';

import { Label } from '@/components/ui/label';

import { 
  Calendar, 
  RotateCcw, 
  Settings2, 
  Clock,
  AlertCircle
} from 'lucide-react';

/**
 * 频次选择器组件
 * 支持每日、每周、间隔、自定义四种频次类型
 * 
 * 修复说明：彻底解决状态同步问题。使用受控组件模式，
 * 确保父组件传递的value变化时，内部状态正确同步。
 */

const FrequencySelector = ({ value, onChange }) => {
  // 内部状态管理 - 使用受控模式
  const [frequencyType, setFrequencyType] = useState(value?.type || 'daily');
  const [dailyTimes, setDailyTimes] = useState(value?.dailyTimes || 1);
  const [weeklyDays, setWeeklyDays] = useState(value?.weeklyDays || [1, 3, 5]);
  const [intervalDays, setIntervalDays] = useState(value?.intervalDays || 2);
  const [customDesc, setCustomDesc] = useState(value?.customDesc || '');

  // 关键修复：当父组件的value变化时，同步更新内部状态
  useEffect(() => {
    if (value) {
      console.log('[FrequencySelector] 从父组件同步值:', value);
      if (value.type !== undefined) setFrequencyType(value.type);
      if (value.dailyTimes !== undefined) setDailyTimes(value.dailyTimes);
      if (value.weeklyDays !== undefined) setWeeklyDays(value.weeklyDays);
      if (value.intervalDays !== undefined) setIntervalDays(value.intervalDays);
      if (value.customDesc !== undefined) setCustomDesc(value.customDesc);
    }
  }, [value]);

  // 通知父组件状态变化 - 使用useCallback避免重复创建
  const notifyChange = useCallback((updates) => {
    const currentValue = {
      type: frequencyType,
      dailyTimes,
      weeklyDays,
      intervalDays,
      customDesc,
      ...updates
    };
    console.log('[FrequencySelector] 通知父组件:', currentValue);
    onChange?.(currentValue);
  }, [frequencyType, dailyTimes, weeklyDays, intervalDays, customDesc, onChange]);

  // 处理频次类型切换
  const handleTypeChange = (type) => {
    console.log('[FrequencySelector] 切换频次类型:', type);
    setFrequencyType(type);
    // 立即通知父组件，使用setTimeout确保状态更新后再通知
    setTimeout(() => {
      const newValue = {
        type,
        dailyTimes,
        weeklyDays,
        intervalDays,
        customDesc
      };
      onChange?.(newValue);
    }, 0);
  };

  // 处理每日次数变化
  const handleDailyTimesChange = (times) => {
    const validTimes = Math.max(1, Math.min(4, times));
    console.log('[FrequencySelector] 设置每日次数:', validTimes);
    setDailyTimes(validTimes);
    setTimeout(() => {
      onChange?.({
        type: frequencyType,
        dailyTimes: validTimes,
        weeklyDays,
        intervalDays,
        customDesc
      });
    }, 0);
  };

  // 处理每周天数切换 - 关键修复：确保状态正确更新并通知父组件
  const toggleWeeklyDay = (day) => {
    setWeeklyDays(prev => {
      const newDays = prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b);
      console.log('[FrequencySelector] 切换每周天数:', day, '结果:', newDays);
      
      // 立即通知父组件新状态
      setTimeout(() => {
        onChange?.({
          type: frequencyType,
          dailyTimes,
          weeklyDays: newDays,
          intervalDays,
          customDesc
        });
      }, 0);
      
      return newDays;
    });
  };

  // 处理间隔天数变化
  const handleIntervalChange = (e) => {
    const inputValue = e.target.value;
    
    // 允许空值，方便用户重新输入
    if (inputValue === '') {
      setIntervalDays('');
      return;
    }
    
    // 只接受数字
    const numValue = parseInt(inputValue, 10);
    if (isNaN(numValue)) return;
    
    // 限制范围 1-30 天
    const validValue = Math.max(1, Math.min(30, numValue));
    setIntervalDays(validValue);
    
    setTimeout(() => {
      onChange?.({
        type: frequencyType,
        dailyTimes,
        weeklyDays,
        intervalDays: validValue,
        customDesc
      });
    }, 0);
  };

  // 处理间隔天数失焦 - 确保有有效值
  const handleIntervalBlur = () => {
    let finalValue = intervalDays;
    if (intervalDays === '' || intervalDays < 1) {
      finalValue = 2;
      setIntervalDays(2);
    }
    setTimeout(() => {
      onChange?.({
        type: frequencyType,
        dailyTimes,
        weeklyDays,
        intervalDays: finalValue,
        customDesc
      });
    }, 0);
  };

  // 处理自定义描述变化 - 关键修复：确保正确传递值
  const handleCustomDescChange = (e) => {
    const desc = e.target.value;
    console.log('[FrequencySelector] 自定义描述变化:', desc);
    setCustomDesc(desc);
    
    // 立即通知父组件
    setTimeout(() => {
      onChange?.({
        type: frequencyType,
        dailyTimes,
        weeklyDays,
        intervalDays,
        customDesc: desc
      });
    }, 0);
  };

  const weekDays = [
    { label: '日', value: 0 },
    { label: '一', value: 1 },
    { label: '二', value: 2 },
    { label: '三', value: 3 },
    { label: '四', value: 4 },
    { label: '五', value: 5 },
    { label: '六', value: 6 },
  ];

  const frequencyTypes = [
    { 
      id: 'daily', 
      label: '每日服用', 
      icon: Clock,
      desc: '每天固定时间服用'
    },
    { 
      id: 'weekly', 
      label: '每周服用', 
      icon: Calendar,
      desc: '选择每周的特定几天'
    },
    { 
      id: 'interval', 
      label: '间隔服用', 
      icon: RotateCcw,
      desc: '每隔几天服用一次'
    },
    { 
      id: 'custom', 
      label: '自定义', 
      icon: Settings2,
      desc: '按需服用，如感冒时'
    },
  ];

  return (
    <div className="space-y-6">
      {/* 频次类型选择 */}
      <div className="grid grid-cols-2 gap-3">
        {frequencyTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = frequencyType === type.id;
          
          return (
            <Card
              key={type.id}
              className={`p-4 cursor-pointer transition-all border-2 ${
                isSelected
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300 hover:shadow-sm'
              }`}
              onClick={() => handleTypeChange(type.id)}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg transition-colors ${
                  isSelected ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <Icon className={`w-5 h-5 ${
                    isSelected ? 'text-green-600' : 'text-gray-500'
                  }`} />
                </div>
                <div>
                  <h4 className={`font-medium ${
                    isSelected ? 'text-green-900' : 'text-gray-900'
                  }`}>
                    {type.label}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">{type.desc}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 每日服用配置 */}
      {frequencyType === 'daily' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <Label className="text-gray-700">每日服用次数</Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((times) => (
              <Button
                key={times}
                type="button"
                variant={dailyTimes === times ? 'default' : 'outline'}
                className={dailyTimes === times ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-gray-100'}
                onClick={() => handleDailyTimesChange(times)}
              >
                {times}次
              </Button>
            ))}
          </div>
          <p className="text-sm text-gray-500">
            每天需要服用 <span className="font-semibold text-green-600">{dailyTimes}</span> 次，请在下一步设置具体时间
          </p>
        </div>
      )}

      {/* 每周服用配置 */}
      {frequencyType === 'weekly' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <Label className="text-gray-700">选择每周服用的日期</Label>
          <div className="flex gap-2 flex-wrap">
            {weekDays.map((day) => (
              <Button
                key={day.value}
                type="button"
                variant={weeklyDays.includes(day.value) ? 'default' : 'outline'}
                className={`w-12 h-12 rounded-full p-0 ${
                  weeklyDays.includes(day.value) ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-gray-100'
                }`}
                onClick={() => toggleWeeklyDay(day.value)}
              >
                {day.label}
              </Button>
            ))}
          </div>
          <div className="text-sm text-gray-500">
            <span>每周 </span>
            <span className="font-semibold text-green-600">
              {weeklyDays.length > 0 
                ? weeklyDays.map(d => weekDays.find(wd => wd.value === d)?.label).join('、')
                : '未选择'}
            </span>
            <span> 服用</span>
            {weeklyDays.length === 0 && (
              <span className="text-amber-600 flex items-center gap-1 mt-1">
                <AlertCircle className="w-4 h-4" />
                请至少选择一天
              </span>
            )}
          </div>
        </div>
      )}

      {/* 间隔服用配置 */}
      {frequencyType === 'interval' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <Label className="text-gray-700">间隔天数</Label>
          <div className="flex items-center gap-3">
            <span className="text-gray-600">每</span>
            <Input
              type="number"
              min={1}
              max={30}
              value={intervalDays}
              onChange={handleIntervalChange}
              onBlur={handleIntervalBlur}
              className="w-20 text-center font-semibold"
              placeholder="2"
            />
            <span className="text-gray-600">天服用一次</span>
          </div>
          <p className="text-sm text-gray-500">
            例如：每 <span className="font-semibold text-green-600">{intervalDays || 2}</span> 天服用一次，即今天服用，跳过 {intervalDays || 2} 天后再服用
          </p>
        </div>
      )}

      {/* 自定义配置 */}
      {frequencyType === 'custom' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <Label className="text-gray-700">服用说明</Label>
          <Input
            placeholder="例如：感冒时服用，每次发烧超过38.5℃时服用"
            value={customDesc}
            onChange={handleCustomDescChange}
            className="bg-white"
          />
          <p className="text-sm text-gray-500">
            请详细描述服用条件，以便后续参考
          </p>
          {customDesc.trim() === '' && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              请输入自定义服用说明
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default FrequencySelector;
