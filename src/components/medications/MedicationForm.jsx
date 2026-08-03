import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Pill, 
  Clock, 
  Package,
  AlertCircle
} from 'lucide-react';
import FrequencySelector from './FrequencySelector';
import { toast } from 'sonner';
import { toLocalDateKey } from '@/lib/dateTime';

/**
 * 用药表单组件（分步式）
 * 支持新增和编辑模式，编辑时自动回填数据
 * 
 * 修复：
 * 1. 库存设置步骤不再选择单位，自动跟随第一步的单位
 * 2. 优化编辑模式数据回填逻辑
 * 3. 修复频次选择器数据同步问题
 */
const MedicationForm = ({ 
  initialData = null, 
  onSubmit, 
  onCancel,
  isEditMode = false 
}) => {
  // 步骤定义 - 根据频次类型动态调整
  const getSteps = (freqType) => {
    const baseSteps = [
      { id: 1, title: '基础信息', icon: Pill },
      { id: 2, title: '服用频次', icon: Clock },
    ];
    
    // 自定义频次不需要设置时间，直接跳到库存
    if (freqType !== 'custom') {
      baseSteps.push({ id: 3, title: '服用时间', icon: Clock });
    }
    
    baseSteps.push({ id: freqType === 'custom' ? 3 : 4, title: '库存设置', icon: Package });
    return baseSteps;
  };

  // 初始化表单数据 - 关键修复：确保编辑模式正确回填数据
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(() => {
    const defaultData = {
      name: '',
      dosage: '',
      unit: '片',
      frequency_type: 'daily',
      frequency_config: { type: 'daily', dailyTimes: 1, weeklyDays: [1, 3, 5], intervalDays: 2, customDesc: '' },
      meal_timing: 'anytime',
      reminder_times: ['08:00'],
      start_date: toLocalDateKey(),
      end_date: '',
      stock_quantity: '',
      stock_unit: '片', // 默认跟随unit
      low_stock_threshold: 7,
      notes: '',
    };
    
    if (initialData && isEditMode) {
      console.log('[MedicationForm] 初始化编辑数据:', initialData);
      return {
        ...defaultData,
        ...initialData,
        // 确保日期格式正确
        start_date: initialData.start_date || toLocalDateKey(),
        reminder_times: initialData.reminder_times || ['08:00'],
        frequency_config: initialData.frequency_config || { type: 'daily', dailyTimes: 1, weeklyDays: [1, 3, 5], intervalDays: 2, customDesc: '' },
        // 库存单位跟随基础单位
        stock_unit: initialData.unit || '片',
      };
    }
    
    return defaultData;
  });

  // 关键修复：当initialData变化时更新表单（支持异步加载）
  useEffect(() => {
    if (initialData && isEditMode) {
      console.log('[MedicationForm] 加载编辑数据:', initialData);
      setFormData(prev => ({
        ...prev,
        ...initialData,
        // 确保日期格式正确
        start_date: initialData.start_date || toLocalDateKey(),
        reminder_times: initialData.reminder_times || ['08:00'],
        frequency_config: initialData.frequency_config || { type: 'daily', dailyTimes: 1, weeklyDays: [1, 3, 5], intervalDays: 2, customDesc: '' },
        // 库存单位跟随基础单位
        stock_unit: initialData.unit || '片',
      }));
    }
  }, [initialData, isEditMode]);

  // 获取当前步骤配置
  const steps = getSteps(formData.frequency_type);

  // 更新表单数据
  const updateFormData = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      // 如果修改了频次类型，重置相关配置
      if (field === 'frequency_type') {
        newData.frequency_config = { ...prev.frequency_config, type: value };
        // 如果切换到自定义频次，清空提醒时间
        if (value === 'custom') {
          newData.reminder_times = [];
        } else if (!newData.reminder_times || newData.reminder_times.length === 0) {
          newData.reminder_times = ['08:00'];
        }
      }
      // 如果修改了单位，同步更新库存单位
      if (field === 'unit') {
        newData.stock_unit = value;
      }
      return newData;
    });
  };

  // 处理频次选择变化 - 关键修复：确保数据正确同步
  const handleFrequencyChange = (freqData) => {
    console.log('[MedicationForm] 频次选择变化:', freqData);
    setFormData(prev => {
      const newData = { 
        ...prev, 
        frequency_config: freqData,
        frequency_type: freqData.type 
      };
      // 如果切换到自定义频次，清空提醒时间
      if (freqData.type === 'custom') {
        newData.reminder_times = [];
      } else if (!newData.reminder_times || newData.reminder_times.length === 0) {
        newData.reminder_times = ['08:00'];
      }
      return newData;
    });
  };

  // 验证当前步骤
  const validateStep = () => {
    switch (currentStep) {
      case 1:
        if (!formData.name.trim()) {
          toast.error('请输入药物名称');
          return false;
        }
        if (!formData.dosage.trim()) {
          toast.error('请输入每次服用剂量');
          return false;
        }
        return true;
      
      case 2:
        const freqType = formData.frequency_type;
        const freqConfig = formData.frequency_config;
        
        if (freqType === 'weekly') {
          // 关键修复：正确检查weeklyDays数组
          const weeklyDays = freqConfig.weeklyDays || [];
          if (weeklyDays.length === 0) {
            toast.error('请至少选择一周的某一天');
            return false;
          }
        }
        if (freqType === 'custom') {
          // 关键修复：正确检查customDesc
          const customDesc = freqConfig.customDesc || '';
          if (!customDesc.trim()) {
            toast.error('请输入自定义服用说明');
            return false;
          }
        }
        return true;
      
      case 3:
        // 如果是自定义频次，这一步是库存设置
        if (formData.frequency_type === 'custom') {
          return validateStockStep();
        }
        // 否则是时间设置
        if (!formData.reminder_times || formData.reminder_times.length === 0) {
          toast.error('请至少设置一个提醒时间');
          return false;
        }
        return true;
      
      case 4:
        return validateStockStep();
      
      default:
        return true;
    }
  };

  // 验证库存步骤
  const validateStockStep = () => {
    if (formData.stock_quantity === '' || formData.stock_quantity < 0) {
      toast.error('请输入当前库存数量');
      return false;
    }
    if (formData.low_stock_threshold < 1) {
      toast.error('预警阈值至少为1天');
      return false;
    }
    return true;
  };

  // 下一步
  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < steps.length) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  // 上一步
  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 提交表单
  const handleSubmit = () => {
    if (validateStep()) {
      // 构建提交数据
      const submitData = {
        ...formData,
        stock_quantity: parseInt(formData.stock_quantity, 10) || 0,
        low_stock_threshold: parseInt(formData.low_stock_threshold, 10) || 7,
        // 确保库存单位与基础单位一致
        stock_unit: formData.unit,
      };
      
      console.log('[MedicationForm] 提交数据:', submitData);
      onSubmit?.(submitData);
    }
  };

  // 添加/删除提醒时间
  const addReminderTime = () => {
    const newTime = '08:00';
    setFormData(prev => ({
      ...prev,
      reminder_times: [...(prev.reminder_times || []), newTime]
    }));
  };

  const removeReminderTime = (index) => {
    setFormData(prev => ({
      ...prev,
      reminder_times: prev.reminder_times.filter((_, i) => i !== index)
    }));
  };

  const updateReminderTime = (index, time) => {
    setFormData(prev => {
      const newTimes = [...prev.reminder_times];
      newTimes[index] = time;
      return { ...prev, reminder_times: newTimes };
    });
  };

  // 渲染步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">药物名称 <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                placeholder="例如：阿托伐他汀钙片"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dosage">每次剂量 <span className="text-red-500">*</span></Label>
                <Input
                  id="dosage"
                  type="number"
                  min="0.1"
                  step="0.1"
                  placeholder="例如：1"
                  value={formData.dosage}
                  onChange={(e) => updateFormData('dosage', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">单位</Label>
                <select
                  id="unit"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={formData.unit}
                  onChange={(e) => updateFormData('unit', e.target.value)}
                >
                  <option value="片">片</option>
                  <option value="粒">粒</option>
                  <option value="mg">mg</option>
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="支">支</option>
                  <option value="包">包</option>
                  <option value="滴">滴</option>
                  <option value="喷">喷</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">备注（可选）</Label>
              <Textarea
                id="notes"
                placeholder="例如：饭后服用，注意监测肝功能"
                value={formData.notes}
                onChange={(e) => updateFormData('notes', e.target.value)}
                rows={3}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <FrequencySelector
              value={formData.frequency_config}
              onChange={handleFrequencyChange}
            />
          </div>
        );

      case 3:
        // 自定义频次直接显示库存设置
        if (formData.frequency_type === 'custom') {
          return renderStockSettings();
        }
        return renderTimeSettings();

      case 4:
        return renderStockSettings();

      default:
        return null;
    }
  };

  // 渲染时间设置
  const renderTimeSettings = () => {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>餐前/餐后</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'before_meal', label: '餐前服用' },
              { value: 'after_meal', label: '餐后服用' },
              { value: 'with_meal', label: '随餐服用' },
              { value: 'anytime', label: '任意时间' },
            ].map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={formData.meal_timing === option.value ? 'default' : 'outline'}
                className={formData.meal_timing === option.value ? 'bg-green-600' : ''}
                onClick={() => updateFormData('meal_timing', option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>提醒时间</Label>
          <div className="space-y-2">
            {formData.reminder_times?.map((time, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => updateReminderTime(index, e.target.value)}
                  className="flex-1"
                />
                {formData.reminder_times.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeReminderTime(index)}
                  >
                    删除
                  </Button>
                )}
              </div>
            ))}
          </div>
          {formData.reminder_times?.length < 4 && (
            <Button
              type="button"
              variant="outline"
              onClick={addReminderTime}
              className="w-full"
            >
              添加提醒时间
            </Button>
          )}
        </div>

        <div className="bg-blue-50 p-3 rounded-lg flex gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <p className="text-sm text-blue-700">
            系统将在设定时间发送服药提醒，请确保允许通知权限
          </p>
        </div>
      </div>
    );
  };

  // 渲染库存设置 - 关键修复：移除单位选择，自动跟随第一步
  const renderStockSettings = () => {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="stock_quantity">当前库存 <span className="text-red-500">*</span></Label>
            <Input
              id="stock_quantity"
              type="number"
              min="0"
              placeholder="例如：30"
              value={formData.stock_quantity}
              onChange={(e) => updateFormData('stock_quantity', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stock_unit">库存单位</Label>
            <div className="w-full h-10 px-3 rounded-md border border-input bg-gray-100 flex items-center text-gray-700">
              {formData.unit}（与药物单位一致）
            </div>
            <input type="hidden" value={formData.unit} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="low_stock_threshold">库存预警阈值（天）</Label>
          <Input
            id="low_stock_threshold"
            type="number"
            min="1"
            max="30"
            value={formData.low_stock_threshold}
            onChange={(e) => updateFormData('low_stock_threshold', parseInt(e.target.value, 10))}
          />
          <p className="text-sm text-gray-500">
            当库存预计可用天数低于此值时，将发送预警提醒
          </p>
        </div>

        <div className="bg-amber-50 p-3 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>计划预览：</strong>
            <br />
            您将服用 <strong>{formData.name || '该药物'}</strong>，
            {formData.frequency_type === 'daily' && `每日 ${formData.frequency_config?.dailyTimes || 1} 次，每次 ${formData.dosage || 1}${formData.unit}`}
            {formData.frequency_type === 'weekly' && `每周特定几天服用，每次 ${formData.dosage || 1}${formData.unit}`}
            {formData.frequency_type === 'interval' && `每 ${formData.frequency_config?.intervalDays || 2} 天服用一次，每次 ${formData.dosage || 1}${formData.unit}`}
            {formData.frequency_type === 'custom' && `按自定义说明服用：${formData.frequency_config?.customDesc || '按需服用'}`}
            <br />
            当前库存 <strong>{formData.stock_quantity || 0}</strong> {formData.unit}，
            预计可用 <strong>{calculateDaysRemaining()}</strong> 天
          </p>
        </div>
      </div>
    );
  };

  // 计算预计可用天数
  const calculateDaysRemaining = () => {
    const stock = parseInt(formData.stock_quantity, 10) || 0;
    const dosage = parseFloat(formData.dosage) || 1;
    const freqType = formData.frequency_type;
    const freqConfig = formData.frequency_config || {};
    
    if (stock <= 0) return 0;
    
    let dailyConsumption = dosage;
    
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
      case 'custom':
        return '未知（自定义频次）';
      default:
        dailyConsumption = dosage;
    }
    
    if (dailyConsumption <= 0) return '未知';
    
    const days = Math.floor(stock / dailyConsumption);
    return days;
  };

  return (
    <div className="space-y-6">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          
          return (
            <div key={step.id} className="flex items-center">
              <div className={`flex flex-col items-center ${
                isActive ? 'text-green-600' : isCompleted ? 'text-green-500' : 'text-gray-400'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${
                  isActive ? 'bg-green-100' : isCompleted ? 'bg-green-50' : 'bg-gray-100'
                }`}>
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span className="text-xs font-medium">{step.title}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-2 ${
                  isCompleted ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* 步骤内容 */}
      <Card className="p-6">
        {renderStepContent()}
      </Card>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        {currentStep > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={handlePrev}
            className="flex-1"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            上一步
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            取消
          </Button>
        )}
        
        {currentStep < steps.length ? (
          <Button
            type="button"
            onClick={handleNext}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            下一步
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {isEditMode ? '保存修改' : '完成添加'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default MedicationForm;
