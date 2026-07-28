import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Check, 
  SkipForward, 
  MoreHorizontal, 
  Edit3, 
  Trash2,
  Package,
  AlertCircle,
  Clock
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * 药物卡片组件
 * 显示药物信息、服用状态、库存状态，支持打卡和操作菜单
 * 
 * 修复：
 * 1. 库存状态简化为三档（告急/不足/充足）
 * 2. 自定义频次药物不显示告急状态和提醒时间
 */

const MedicationCard = ({ 
  medication, 
  log, 
  onCheckIn, 
  onSkip, 
  onEdit, 
  onDelete,
  isFutureDate = false,
  isToday = true
}) => {
  const [isPressed, setIsPressed] = useState(false);

  // 判断是否为自定义频次
  const isCustomFrequency = medication?.frequency_type === 'custom';

  // 获取状态信息
  const getStatusInfo = () => {
    if (!log) return { status: 'pending', label: '待服用', color: 'gray' };
    
    switch (log.status) {
      case 'taken':
        return { status: 'taken', label: '已服用', color: 'green' };
      case 'skipped':
        return { status: 'skipped', label: '已跳过', color: 'gray' };
      default:
        return { status: 'pending', label: '待服用', color: 'gray' };
    }
  };

  // 计算库存状态 - 简化为三档：告急/不足/充足
  // 自定义频次不显示告急状态
  const calculateStockStatus = () => {
    const med = medication;
    
    // 自定义频次不显示库存状态
    if (isCustomFrequency) {
      return { status: 'custom', label: '按需', color: 'blue', days: null };
    }
    
    if (!med || med.stock_quantity <= 0) {
      return { status: 'empty', label: '已耗尽', color: 'red', days: 0 };
    }

    const dosage = parseFloat(med.dosage) || 1;
    const stock = med.stock_quantity;
    
    // 计算每日消耗量
    let dailyConsumption = dosage;
    const freqType = med.frequency_type;
    const freqConfig = med.frequency_config || {};
    
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

    if (dailyConsumption <= 0) {
      return { status: 'unknown', label: '未知', color: 'gray', days: 0 };
    }

    const daysRemaining = Math.floor(stock / dailyConsumption);
    const threshold = med.low_stock_threshold || 7;

    if (daysRemaining <= 0) {
      return { status: 'empty', label: '已耗尽', color: 'red', days: 0 };
    } else if (daysRemaining <= 3) {
      return { status: 'critical', label: '告急', color: 'red', days: daysRemaining };
    } else if (daysRemaining <= threshold) {
      return { status: 'low', label: '不足', color: 'yellow', days: daysRemaining };
    } else {
      return { status: 'adequate', label: '充足', color: 'green', days: daysRemaining };
    }
  };

  const statusInfo = getStatusInfo();
  const stockStatus = calculateStockStatus();
  const isTaken = statusInfo.status === 'taken';
  const isSkipped = statusInfo.status === 'skipped';
  const isEmpty = stockStatus.status === 'empty';

  // 判断是否可以打卡
  const canCheckIn = !isFutureDate && !isTaken && !isSkipped && !isEmpty;

  // 获取频次描述
  const getFrequencyDesc = () => {
    const med = medication;
    const freqType = med.frequency_type;
    const freqConfig = med.frequency_config || {};
    const unit = med.unit || '片';
    
    if (freqType === 'custom') {
      return '按需服用';
    }
    
    switch (freqType) {
      case 'daily':
        return `每日${freqConfig.dailyTimes || 1}次`;
      case 'weekly':
        const days = freqConfig.weeklyDays || [];
        if (days.length === 0) return '每周服用';
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        return `每周${days.map(d => dayNames[d]).join('')}`;
      case 'interval':
        return `每${freqConfig.intervalDays || 2}天`;
      default:
        return '定期';
    }
  };

  // 获取提醒时间显示 - 自定义频次不显示
  const getReminderTime = () => {
    // 自定义频次不显示提醒时间
    if (isCustomFrequency) {
      return null;
    }
    
    if (medication._time) {
      return medication._time;
    }
    if (medication.reminder_times && medication.reminder_times.length > 0) {
      return medication.reminder_times[0];
    }
    return '08:00';
  };

  const reminderTime = getReminderTime();

  return (
    <Card 
      className={`p-4 transition-all ${
        isTaken ? 'bg-green-50 border-green-200' : 
        isSkipped ? 'bg-gray-50 border-gray-200' :
        isFutureDate ? 'bg-blue-50/50 border-blue-100' :
        'bg-white'
      } ${isPressed ? 'scale-[0.98]' : ''}`}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      <div className="flex items-center gap-3">
        {/* 状态指示器 */}
        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
          isTaken ? 'bg-green-100' : 
          isSkipped ? 'bg-gray-100' : 
          isFutureDate ? 'bg-blue-100' :
          'bg-blue-50'
        }`}>
          {isTaken ? (
            <Check className="w-6 h-6 text-green-600" />
          ) : isSkipped ? (
            <SkipForward className="w-6 h-6 text-gray-500" />
          ) : isFutureDate ? (
            <Clock className="w-6 h-6 text-blue-400" />
          ) : (
            <Package className="w-6 h-6 text-blue-500" />
          )}
        </div>

        {/* 药物信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`font-medium truncate ${
              isTaken || isSkipped ? 'text-gray-500 line-through' : 
              isFutureDate ? 'text-blue-700' :
              'text-gray-900'
            }`}>
              {medication.name}
            </h4>
            <Badge 
              variant="secondary" 
              className={`text-xs flex-shrink-0 ${
                statusInfo.color === 'green' ? 'bg-green-100 text-green-700' :
                statusInfo.color === 'gray' ? 'bg-gray-100 text-gray-600' :
                'bg-blue-100 text-blue-700'
              }`}
            >
              {isFutureDate ? '待服用' : statusInfo.label}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
            <span>{medication.dosage}{medication.unit || '片'}</span>
            <span>·</span>
            <span>{getFrequencyDesc()}</span>
            
            {/* 未来日期显示计划时间 - 自定义频次不显示 */}
            {isFutureDate && reminderTime && !isCustomFrequency && (
              <>
                <span>·</span>
                <span className="text-blue-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {reminderTime}
                </span>
              </>
            )}
            
            {/* 库存状态显示 - 只在今天显示，自定义频次不显示 */}
            {!isTaken && !isSkipped && !isFutureDate && !isCustomFrequency && (
              <>
                <span>·</span>
                <span className={`flex items-center gap-1 ${
                  stockStatus.color === 'red' ? 'text-red-600 font-medium' :
                  stockStatus.color === 'yellow' ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  <Package className="w-3 h-3" />
                  {stockStatus.label}
                  {stockStatus.days !== null && stockStatus.days > 0 && `(${stockStatus.days}天)`}
                </span>
              </>
            )}
            
            {/* 自定义频次显示按需标识 */}
            {isCustomFrequency && (
              <>
                <span>·</span>
                <span className="text-blue-600 flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  按需
                </span>
              </>
            )}
          </div>

          {/* 库存告急警告 - 自定义频次不显示 */}
          {!isTaken && !isSkipped && !isFutureDate && !isCustomFrequency && stockStatus.status === 'critical' && (
            <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
              <AlertCircle className="w-3 h-3" />
              库存即将耗尽，请及时补充
            </div>
          )}

          {/* 未来日期提示 */}
          {isFutureDate && (
            <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
              <Clock className="w-3 h-3" />
              这是未来的用药计划，不能提前打卡
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1">
          {!isTaken && !isSkipped ? (
            <>
              <Button
                size="sm"
                className={`h-9 px-3 ${
                  canCheckIn 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
                onClick={() => canCheckIn && onCheckIn?.(medication)}
                disabled={!canCheckIn}
                title={isFutureDate ? '不能提前打卡' : isEmpty ? '库存不足' : '确认打卡'}
              >
                <Check className="w-4 h-4 mr-1" />
                {isFutureDate ? '待打卡' : '确认'}
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!isFutureDate && (
                    <DropdownMenuItem onClick={() => onSkip?.(medication)}>
                      <SkipForward className="w-4 h-4 mr-2" />
                      跳过本次
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onEdit?.(medication)}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    编辑
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => onEdit?.(medication)}
              >
                <Edit3 className="w-4 h-4 text-gray-500" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => onDelete?.(medication)}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default MedicationCard;
