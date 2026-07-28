import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import { Heart, Droplets, Scale, Calendar, Clock, StickyNote, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { checkHealthValue, HEALTH_STANDARDS } from '@/hooks/useDefaultData';

/**
 * 健康记录表单组件（分步式）
 * 支持血压、血糖、体重三种类型的记录
 */
const RecordForm = ({ 
  initialData = null, 
  onSubmit, 
  onCancel,
  isLoading = false 
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    record_type: 'blood_pressure',
    values: {},
    recorded_at: new Date().toISOString(),
    note: '',
    ...initialData
  });
  const [warnings, setWarnings] = useState([]);

  // 记录类型配置
  const recordTypes = [
    { 
      type: 'blood_pressure', 
      title: '血压', 
      icon: Heart,
      description: '收缩压/舒张压/心率',
      color: 'rose'
    },
    { 
      type: 'blood_sugar', 
      title: '血糖', 
      icon: Droplets,
      description: '空腹/餐后血糖值',
      color: 'blue'
    },
    { 
      type: 'weight', 
      title: '体重', 
      icon: Scale,
      description: '体重/BMI计算',
      color: 'emerald'
    }
  ];

  // 更新表单数据
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 更新数值
  const updateValue = (key, value) => {
    const newValues = { ...formData.values, [key]: value };
    setFormData(prev => ({
      ...prev,
      values: newValues
    }));
    
    // 实时检查健康标准
    const newWarnings = checkHealthValue(formData.record_type, newValues);
    setWarnings(newWarnings);
  };

  // 验证当前步骤
  const validateStep = () => {
    switch (currentStep) {
      case 1:
        return true;
      case 2:
        if (formData.record_type === 'blood_pressure') {
          if (!formData.values.systolic || !formData.values.diastolic) {
            return false;
          }
        } else if (formData.record_type === 'blood_sugar') {
          if (!formData.values.value) {
            return false;
          }
        } else if (formData.record_type === 'weight') {
          if (!formData.values.value) {
            return false;
          }
        }
        return true;
      default:
        return true;
    }
  };

  // 下一步
  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  // 上一步
  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // 提交
  const handleSubmit = () => {
    // 计算BMI
    if (formData.record_type === 'weight' && formData.values.value && formData.values.height) {
      const height = formData.values.height / 100; // 转换为米
      const bmi = (formData.values.value / (height * height)).toFixed(1);
      formData.values.bmi = parseFloat(bmi);
    }
    
    onSubmit?.(formData);
  };

  // 渲染步骤1：选择类型
  const renderStep1 = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 mb-4">请选择要记录的健康指标类型</p>
      
      <RadioGroup
        value={formData.record_type}
        onValueChange={(value) => {
          updateField('record_type', value);
          setWarnings([]); // 切换类型时清空警告
        }}
        className="space-y-3"
      >
        {recordTypes.map(({ type, title, icon: Icon, description, color }) => (
          <div key={type}>
            <RadioGroupItem value={type} id={type} className="peer sr-only" />
            <Label
              htmlFor={type}
              className={cn(
                "flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all",
                "hover:border-gray-300",
                formData.record_type === type
                  ? `border-${color}-500 bg-${color}-50`
                  : "border-gray-200 bg-white"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center mr-4",
                formData.record_type === type ? `bg-${color}-100` : 'bg-gray-100'
              )}>
                <Icon className={cn(
                  "w-6 h-6",
                  formData.record_type === type ? `text-${color}-600` : 'text-gray-500'
                )} />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{title}</h4>
                <p className="text-sm text-gray-500">{description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  // 渲染步骤2：输入数值
  const renderStep2 = () => {
    const currentType = recordTypes.find(t => t.type === formData.record_type);
    const color = currentType?.color || 'gray';
    
    // 获取参考范围
    const getReferenceRange = () => {
      if (formData.record_type === 'blood_pressure') {
        const std = HEALTH_STANDARDS.blood_pressure;
        return `正常范围：收缩压 ${std.systolic.min}-${std.systolic.max} ${std.systolic.unit}，舒张压 ${std.diastolic.min}-${std.diastolic.max} ${std.diastolic.unit}`;
      } else if (formData.record_type === 'blood_sugar') {
        const timing = formData.values.timing || 'fasting';
        const std = HEALTH_STANDARDS.blood_sugar[timing];
        return `正常范围：${std.label} ${std.min}-${std.max} ${std.unit}`;
      } else if (formData.record_type === 'weight') {
        const std = HEALTH_STANDARDS.weight.bmi;
        return `健康BMI范围：${std.min}-${std.max}`;
      }
      return '';
    };
    
    return (
      <div className="space-y-6">
        {/* 警告提示 */}
        {warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">健康提示</p>
                {warnings.map((warning, idx) => (
                  <p key={idx} className="text-amber-700">{warning}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 血压记录 */}
        {formData.record_type === 'blood_pressure' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="systolic">
                  收缩压 <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-400 ml-1">(高压)</span>
                </Label>
                <Input
                  id="systolic"
                  type="number"
                  placeholder="120"
                  value={formData.values.systolic || ''}
                  onChange={(e) => updateValue('systolic', parseInt(e.target.value) || '')}
                  className="h-12 text-lg"
                />
                <p className="text-xs text-gray-400">mmHg</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="diastolic">
                  舒张压 <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-400 ml-1">(低压)</span>
                </Label>
                <Input
                  id="diastolic"
                  type="number"
                  placeholder="80"
                  value={formData.values.diastolic || ''}
                  onChange={(e) => updateValue('diastolic', parseInt(e.target.value) || '')}
                  className="h-12 text-lg"
                />
                <p className="text-xs text-gray-400">mmHg</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="heart_rate">心率</Label>
              <Input
                id="heart_rate"
                type="number"
                placeholder="75"
                value={formData.values.heart_rate || ''}
                onChange={(e) => updateValue('heart_rate', parseInt(e.target.value) || '')}
                className="h-12 text-lg"
              />
              <p className="text-xs text-gray-400">次/分</p>
            </div>
            
            {/* 参考范围提示 */}
            <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600">
              <p className="font-medium mb-1">参考范围：</p>
              <p>{getReferenceRange()}</p>
            </div>
          </>
        )}

        {/* 血糖记录 */}
        {formData.record_type === 'blood_sugar' && (
          <>
            <div className="space-y-3">
              <Label>测量时机</Label>
              <RadioGroup
                value={formData.values.timing || 'fasting'}
                onValueChange={(value) => updateValue('timing', value)}
                className="grid grid-cols-3 gap-3"
              >
                {[
                  { value: 'fasting', label: '空腹' },
                  { value: 'post_meal', label: '餐后2小时' },
                  { value: 'random', label: '随机' }
                ].map(({ value, label }) => (
                  <div key={value}>
                    <RadioGroupItem value={value} id={value} className="peer sr-only" />
                    <Label
                      htmlFor={value}
                      className={cn(
                        "flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all text-sm",
                        formData.values.timing === value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-700"
                      )}
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sugar_value">
                血糖值 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="sugar_value"
                type="number"
                step="0.1"
                placeholder="5.6"
                value={formData.values.value || ''}
                onChange={(e) => updateValue('value', parseFloat(e.target.value) || '')}
                className="h-12 text-lg"
              />
              <p className="text-xs text-gray-400">mmol/L</p>
            </div>
            
            {/* 参考范围提示 */}
            <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600">
              <p className="font-medium mb-1">参考范围：</p>
              <p>{getReferenceRange()}</p>
            </div>
          </>
        )}

        {/* 体重记录 */}
        {formData.record_type === 'weight' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="weight_value">
                体重 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="weight_value"
                type="number"
                step="0.1"
                placeholder="65.5"
                value={formData.values.value || ''}
                onChange={(e) => updateValue('value', parseFloat(e.target.value) || '')}
                className="h-12 text-lg"
              />
              <p className="text-xs text-gray-400">kg</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="height">
                身高 <span className="text-xs text-gray-400">(用于计算BMI)</span>
              </Label>
              <Input
                id="height"
                type="number"
                placeholder="170"
                value={formData.values.height || ''}
                onChange={(e) => updateValue('height', parseInt(e.target.value) || '')}
                className="h-12 text-lg"
              />
              <p className="text-xs text-gray-400">cm</p>
            </div>
            
            {/* BMI预览 */}
            {formData.values.value && formData.values.height && (
              <div className="bg-emerald-50 p-3 rounded-lg text-sm">
                <p className="font-medium text-emerald-800">
                  BMI: {((formData.values.value / Math.pow(formData.values.height / 100, 2))).toFixed(1)}
                </p>
                <p className="text-emerald-600 text-xs mt-1">
                  {(() => {
                    const bmi = formData.values.value / Math.pow(formData.values.height / 100, 2);
                    if (bmi < 18.5) return '体重过轻';
                    if (bmi < 24) return '体重正常';
                    if (bmi < 28) return '超重';
                    return '肥胖';
                  })()}
                </p>
              </div>
            )}
            
            {/* 参考范围提示 */}
            <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600">
              <p className="font-medium mb-1">参考范围：</p>
              <p>{getReferenceRange()}</p>
            </div>
          </>
        )}
      </div>
    );
  };

  // 渲染步骤3：时间和备注
  const renderStep3 = () => (
    <div className="space-y-6">
      {/* 记录时间 */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          记录日期
        </Label>
        <Input
          type="date"
          value={formData.recorded_at.split('T')[0]}
          onChange={(e) => {
            const date = e.target.value;
            const time = formData.recorded_at.split('T')[1] || '08:00:00.000Z';
            updateField('recorded_at', `${date}T${time}`);
          }}
          className="h-12"
        />
      </div>
      
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          记录时间
        </Label>
        <Input
          type="time"
          value={formData.recorded_at.split('T')[1]?.slice(0, 5) || '08:00'}
          onChange={(e) => {
            const date = formData.recorded_at.split('T')[0];
            updateField('recorded_at', `${date}T${e.target.value}:00.000Z`);
          }}
          className="h-12"
        />
      </div>

      {/* 备注 */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <StickyNote className="w-4 h-4" />
          备注（可选）
        </Label>
        <textarea
          placeholder="例如：运动后测量、服药后测量等"
          value={formData.note}
          onChange={(e) => updateField('note', e.target.value)}
          className="w-full h-24 px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* 汇总卡片 */}
      <Card className="p-4 bg-gray-50">
        <h4 className="font-medium text-gray-900 mb-2">记录预览</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p>
            <span className="font-medium">类型：</span>
            {recordTypes.find(t => t.type === formData.record_type)?.title}
          </p>
          <p>
            <span className="font-medium">数值：</span>
            {formData.record_type === 'blood_pressure' && (
              `${formData.values.systolic || '--'}/${formData.values.diastolic || '--'} mmHg`
            )}
            {formData.record_type === 'blood_sugar' && (
              `${formData.values.value || '--'} mmol/L (${formData.values.timing === 'fasting' ? '空腹' : formData.values.timing === 'post_meal' ? '餐后' : '随机'})`
            )}
            {formData.record_type === 'weight' && (
              `${formData.values.value || '--'} kg`
            )}
          </p>
          <p>
            <span className="font-medium">时间：</span>
            {formData.recorded_at.split('T')[0]} {formData.recorded_at.split('T')[1]?.slice(0, 5)}
          </p>
        </div>
      </Card>
    </div>
  );

  // 根据步骤渲染内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      default: return null;
    }
  };

  // 步骤标题
  const stepTitles = ['选择类型', '输入数值', '确认提交'];

  return (
    <div className="space-y-6">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
              currentStep === step 
                ? "bg-green-600 text-white"
                : currentStep > step 
                  ? "bg-green-100 text-green-600"
                  : "bg-gray-100 text-gray-400"
            )}>
              {currentStep > step ? '✓' : step}
            </div>
            {step < 3 && (
              <div className={cn(
                "w-8 h-0.5 mx-1",
                currentStep > step ? "bg-green-600" : "bg-gray-200"
              )} />
            )}
          </div>
        ))}
      </div>
      
      <p className="text-center text-sm text-gray-500 mb-4">
        {stepTitles[currentStep - 1]}
      </p>

      {/* 步骤内容 */}
      <div className="min-h-[300px]">
        {renderStepContent()}
      </div>

      {/* 底部按钮 */}
      <div className="flex gap-3 pt-4 border-t">
        {currentStep > 1 ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-12"
            onClick={handlePrev}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            上一步
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-12"
            onClick={onCancel}
          >
            取消
          </Button>
        )}
        
        {currentStep < 3 ? (
          <Button
            type="button"
            className="flex-1 h-12 bg-green-600 hover:bg-green-700"
            onClick={handleNext}
            disabled={!validateStep()}
          >
            下一步
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            type="button"
            className="flex-1 h-12 bg-green-600 hover:bg-green-700"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? '保存中...' : '完成'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default RecordForm;
