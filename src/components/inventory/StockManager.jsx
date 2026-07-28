import { useState } from 'react';
import { X, Package, Plus, Minus, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * 库存管理器组件
 * 快速调整药品库存数量
 */
const StockManager = ({ 
  isOpen, 
  onClose, 
  medication, 
  onUpdate,
  isLoading = false 
}) => {
  const [adjustment, setAdjustment] = useState(0);
  const [newStock, setNewStock] = useState('');
  const [mode, setMode] = useState('adjust'); // 'adjust' | 'set'

  if (!isOpen || !medication) return null;

  const currentStock = medication.stock_quantity || 0;
  const unit = medication.stock_unit || '片';

  // 处理快速调整
  const handleQuickAdjust = (delta) => {
    setAdjustment(prev => prev + delta);
  };

  // 处理确认
  const handleConfirm = () => {
    let finalStock;
    
    if (mode === 'adjust') {
      finalStock = Math.max(0, currentStock + adjustment);
    } else {
      finalStock = parseInt(newStock) || 0;
    }

    if (finalStock === currentStock) {
      onClose?.();
      return;
    }

    onUpdate?.({
      ...medication,
      stock_quantity: finalStock
    });
  };

  // 计算预计可用天数
  const getEstimatedDays = (stock) => {
    const dailyConsumption = medication.frequency_type === 'daily'
      ? (medication.frequency_config?.times_per_day || 1) * (medication.dosage || 1)
      : (medication.dosage || 1);
    return Math.floor(stock / dailyConsumption);
  };

  const displayStock = mode === 'adjust' 
    ? Math.max(0, currentStock + adjustment) 
    : (parseInt(newStock) || 0);
  
  const estimatedDays = getEstimatedDays(displayStock);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-sm bg-white rounded-2xl shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Package className="w-4 h-4 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">更新库存</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-4">
          {/* 药物信息 */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-medium text-gray-900">{medication.name}</p>
            <p className="text-sm text-gray-500">
              当前库存: {currentStock} {unit}
            </p>
          </div>

          {/* 模式切换 */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === 'adjust' ? 'default' : 'outline'}
              size="sm"
              className={cn("flex-1", mode === 'adjust' && "bg-green-600")}
              onClick={() => {
                setMode('adjust');
                setAdjustment(0);
              }}
            >
              <Calculator className="w-4 h-4 mr-1" />
              增减调整
            </Button>
            <Button
              type="button"
              variant={mode === 'set' ? 'default' : 'outline'}
              size="sm"
              className={cn("flex-1", mode === 'set' && "bg-green-600")}
              onClick={() => {
                setMode('set');
                setNewStock(String(currentStock));
              }}
            >
              直接设置
            </Button>
          </div>

          {/* 调整模式 */}
          {mode === 'adjust' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={() => handleQuickAdjust(-1)}
                >
                  <Minus className="w-5 h-5" />
                </Button>
                
                <div className="text-center min-w-[100px]">
                  <span className={cn(
                    "text-3xl font-bold",
                    adjustment > 0 ? "text-green-600" : adjustment < 0 ? "text-red-600" : "text-gray-900"
                  )}>
                    {adjustment > 0 ? '+' : ''}{adjustment}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{unit}</p>
                </div>
                
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={() => handleQuickAdjust(1)}
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
              
              {/* 快捷按钮 */}
              <div className="flex gap-2 justify-center">
                {[5, 10, 30].map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAdjust(amount)}
                  >
                    +{amount}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 直接设置模式 */}
          {mode === 'set' && (
            <div className="space-y-2">
              <Label>设置库存数量</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  className="text-center text-lg"
                  placeholder="输入数量"
                  autoFocus
                />
                <span className="text-gray-500 whitespace-nowrap">{unit}</span>
              </div>
            </div>
          )}

          {/* 预览 */}
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-sm text-blue-600">
              更新后: <span className="font-semibold">{displayStock}</span> {unit}
            </p>
            <p className="text-xs text-blue-500 mt-1">
              预计可用约 <span className="font-semibold">{estimatedDays}</span> 天
            </p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 p-4 border-t">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={handleConfirm}
            disabled={isLoading || (mode === 'set' && newStock === '')}
          >
            {isLoading ? '保存中...' : '确认更新'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default StockManager;
