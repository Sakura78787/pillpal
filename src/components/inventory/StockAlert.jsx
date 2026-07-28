import { useMemo } from 'react';
import { AlertTriangle, Package, ChevronRight, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * 库存预警组件
 * 在Dashboard顶部显示低库存提醒
 * 
 * 修复：自定义频次药物不显示库存预警
 * 
 * @param {Array} medications - 用药计划列表
 * @param {Function} onViewAll - 查看全部回调
 * @param {Function} onAddStock - 补货回调
 */
const StockAlert = ({ medications = [], onViewAll, onAddStock }) => {
  // 计算需要预警的药品 - 过滤掉自定义频次
  const alertMeds = useMemo(() => {
    return medications
      .filter(med => {
        // 过滤掉自定义频次药物
        if (med.frequency_type === 'custom') return false;
        
        if (med.status !== 'active' || med.stock_quantity <= 0) return false;
        
        const dosage = parseFloat(med.dosage) || 1;
        const stock = med.stock_quantity;
        const threshold = med.low_stock_threshold || 7;
        
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
        
        if (dailyConsumption <= 0) return false;
        
        const daysRemaining = Math.floor(stock / dailyConsumption);
        return daysRemaining <= threshold;
      })
      .map(med => {
        const dosage = parseFloat(med.dosage) || 1;
        const stock = med.stock_quantity;
        const freqConfig = med.frequency_config || {};
        
        let dailyConsumption = dosage;
        switch (med.frequency_type) {
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
        
        const daysRemaining = Math.floor(stock / dailyConsumption);
        
        return {
          ...med,
          daysRemaining,
          isCritical: daysRemaining <= 3
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 3); // 最多显示3个
  }, [medications]);

  if (alertMeds.length === 0) return null;

  return (
    <Card className="p-4 border-amber-200 bg-amber-50/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h3 className="font-medium text-amber-900">库存预警</h3>
            <p className="text-xs text-amber-700">
              {alertMeds.length}种药品库存不足
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-amber-700 h-8"
          onClick={onViewAll}
        >
          查看全部
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <div className="space-y-2">
        {alertMeds.map((med) => (
          <div 
            key={med.id}
            className={`flex items-center justify-between p-2 rounded-lg ${
              med.isCritical ? 'bg-red-50 border border-red-100' : 'bg-white border border-amber-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <Package className={`w-4 h-4 ${med.isCritical ? 'text-red-500' : 'text-amber-500'}`} />
              <div>
                <p className={`text-sm font-medium ${med.isCritical ? 'text-red-700' : 'text-gray-900'}`}>
                  {med.name}
                </p>
                <p className={`text-xs ${med.isCritical ? 'text-red-600' : 'text-gray-500'}`}>
                  预计可用{med.daysRemaining}天
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className={`h-7 px-2 ${med.isCritical ? 'text-red-600 hover:text-red-700 hover:bg-red-100' : 'text-amber-600 hover:text-amber-700 hover:bg-amber-100'}`}
              onClick={() => onAddStock?.(med)}
            >
              <Plus className="w-3 h-3 mr-1" />
              补货
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default StockAlert;
