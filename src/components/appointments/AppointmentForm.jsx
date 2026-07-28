import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Calendar, 
  Building2, 
  Stethoscope, 
  User, 
  Clock,
  AlertCircle,
  ListTodo
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * 复诊预约表单组件（分步式弹窗）
 * 支持新增和编辑模式，以弹窗形式展示
 */
const AppointmentForm = ({ 
  isOpen = false,
  onClose,
  initialData = null, 
  onSubmit, 
  isLoading = false 
}) => {
  const isEditMode = !!initialData;
  
  // 步骤定义
  const steps = [
    { id: 1, title: '基本信息', icon: Building2 },
    { id: 2, title: '检查项目', icon: ListTodo },
    { id: 3, title: '提醒设置', icon: Clock },
  ];

  // 初始化表单数据 - 关键修复：复诊日期默认填充当天
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    const defaultData = {
      hospital_name: '',
      department: '',
      doctor_name: '',
      appointment_date: today, // 默认当天日期
      appointment_time: '09:00',
      is_first_visit: false,
      checkup_items: [],
      reminder_days: 3,
      notes: '',
    };
    
    if (initialData && isEditMode) {
      console.log('[AppointmentForm] 初始化编辑数据:', initialData);
      return {
        ...defaultData,
        ...initialData,
        // 确保日期格式正确，如果没有则使用当天
        appointment_date: initialData.appointment_date || today,
      };
    }
    
    return defaultData;
  });

  // 关键修复：当initialData变化时更新表单
  useEffect(() => {
    if (initialData && isEditMode) {
      const today = new Date().toISOString().split('T')[0];
      console.log('[AppointmentForm] 加载编辑数据:', initialData);
      setFormData(prev => ({
        ...prev,
        ...initialData,
        appointment_date: initialData.appointment_date || today,
      }));
    }
  }, [initialData, isEditMode]);

  // 弹窗关闭时重置步骤
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
    }
  }, [isOpen]);

  // 更新表单数据
  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 验证当前步骤
  const validateStep = () => {
    switch (currentStep) {
      case 1:
        if (!formData.hospital_name.trim()) {
          toast.error('请输入医院名称');
          return false;
        }
        if (!formData.department.trim()) {
          toast.error('请输入科室');
          return false;
        }
        if (!formData.appointment_date) {
          toast.error('请选择复诊日期');
          return false;
        }
        return true;
      
      case 2:
        return true;
      
      case 3:
        if (formData.reminder_days < 1 || formData.reminder_days > 30) {
          toast.error('提醒天数需在1-30天之间');
          return false;
        }
        return true;
      
      default:
        return true;
    }
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
      console.log('[AppointmentForm] 提交数据:', formData);
      onSubmit?.(formData);
    }
  };

  // 常见检查项目
  const commonCheckupItems = [
    '血压测量', '血糖检测', '血脂检查', '肝功能', '肾功能', 
    '心电图', '心脏彩超', '颈动脉超声', '眼底检查', '尿常规'
  ];

  // 切换检查项目
  const toggleCheckupItem = (item) => {
    setFormData(prev => {
      const currentItems = prev.checkup_items || [];
      const newItems = currentItems.includes(item)
        ? currentItems.filter(i => i !== item)
        : [...currentItems, item];
      return { ...prev, checkup_items: newItems };
    });
  };

  // 添加自定义检查项目
  const [customItem, setCustomItem] = useState('');
  const addCustomItem = () => {
    if (customItem.trim()) {
      setFormData(prev => ({
        ...prev,
        checkup_items: [...(prev.checkup_items || []), customItem.trim()]
      }));
      setCustomItem('');
    }
  };

  // 渲染步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hospital_name">医院名称 <span className="text-red-500">*</span></Label>
              <Input
                id="hospital_name"
                placeholder="例如：市第一人民医院"
                value={formData.hospital_name}
                onChange={(e) => updateFormData('hospital_name', e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">科室 <span className="text-red-500">*</span></Label>
                <Input
                  id="department"
                  placeholder="例如：心内科"
                  value={formData.department}
                  onChange={(e) => updateFormData('department', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doctor_name">医生姓名</Label>
                <Input
                  id="doctor_name"
                  placeholder="例如：张医生（可选）"
                  value={formData.doctor_name}
                  onChange={(e) => updateFormData('doctor_name', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="appointment_date">复诊日期 <span className="text-red-500">*</span></Label>
                <Input
                  id="appointment_date"
                  type="date"
                  value={formData.appointment_date}
                  onChange={(e) => updateFormData('appointment_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointment_time">预约时间</Label>
                <Input
                  id="appointment_time"
                  type="time"
                  value={formData.appointment_time}
                  onChange={(e) => updateFormData('appointment_time', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>是否首诊</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={!formData.is_first_visit ? 'default' : 'outline'}
                  className={!formData.is_first_visit ? 'bg-green-600' : ''}
                  onClick={() => updateFormData('is_first_visit', false)}
                >
                  复诊
                </Button>
                <Button
                  type="button"
                  variant={formData.is_first_visit ? 'default' : 'outline'}
                  className={formData.is_first_visit ? 'bg-green-600' : ''}
                  onClick={() => updateFormData('is_first_visit', true)}
                >
                  首诊
                </Button>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>常见检查项目</Label>
              <div className="flex flex-wrap gap-2">
                {commonCheckupItems.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant={formData.checkup_items?.includes(item) ? 'default' : 'outline'}
                    size="sm"
                    className={formData.checkup_items?.includes(item) ? 'bg-green-600' : ''}
                    onClick={() => toggleCheckupItem(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>自定义检查项目</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="输入其他检查项目"
                  value={customItem}
                  onChange={(e) => setCustomItem(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCustomItem()}
                />
                <Button type="button" onClick={addCustomItem}>
                  添加
                </Button>
              </div>
            </div>

            {formData.checkup_items?.length > 0 && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <Label className="text-sm text-gray-600 mb-2 block">已选择的检查项目：</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.checkup_items.map((item, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded text-sm"
                    >
                      {item}
                      <button
                        type="button"
                        className="ml-1 text-green-600 hover:text-green-800"
                        onClick={() => toggleCheckupItem(item)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 p-3 rounded-lg flex gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-700">
                系统将在复诊前提醒您准备相关检查项目
              </p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reminder_days">提前提醒天数</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="reminder_days"
                  type="number"
                  min={1}
                  max={30}
                  value={formData.reminder_days}
                  onChange={(e) => updateFormData('reminder_days', parseInt(e.target.value) || 3)}
                  className="w-20"
                />
                <span className="text-gray-600">天</span>
              </div>
              <p className="text-sm text-gray-500">
                系统将在复诊前 {formData.reminder_days} 天发送提醒通知
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">备注（可选）</Label>
              <textarea
                id="notes"
                placeholder="例如：需要空腹、带齐既往检查报告等"
                value={formData.notes}
                onChange={(e) => updateFormData('notes', e.target.value)}
                className="w-full h-24 px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="bg-amber-50 p-3 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>提醒预览：</strong>
                <br />
                您预约了 <strong>{formData.hospital_name || '某医院'}</strong> {formData.department || '某科室'} 的复诊，
                系统将在 <strong>{formData.reminder_days} 天后</strong>（即就诊前 {formData.reminder_days} 天）发送提醒。
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            {isEditMode ? '编辑复诊预约' : '添加复诊预约'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
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
                disabled={isLoading}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                上一步
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isLoading}
              >
                取消
              </Button>
            )}
            
            {currentStep < steps.length ? (
              <Button
                type="button"
                onClick={handleNext}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={isLoading}
              >
                下一步
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    保存中...
                  </span>
                ) : (
                  <>{isEditMode ? '保存修改' : '完成添加'}</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentForm;
