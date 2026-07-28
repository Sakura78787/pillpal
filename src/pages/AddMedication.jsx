import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Pill, ScanLine, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import MedicationForm from '@/components/medications/MedicationForm';
import { useAuthStore } from '@/store/authStore';
import { useMedicationStore } from '@/store/medicationStore';
import { useUIStore } from '@/store/uiStore';

/**
 * 添加药物页面
 * 支持手动添加和扫码添加（扫码功能开发中）
 */
const AddMedication = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addMedication } = useMedicationStore();
  const { setPageTitle } = useUIStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 设置页面标题
  useEffect(() => {
    setPageTitle('添加药物');
  }, [setPageTitle]);

  // 处理表单提交
  const handleSubmit = async (formData) => {
    if (!user?.id) {
      toast.error('请先登录');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addMedication(user.id, formData);

      if (result.success) {
        toast.success(`${formData.name} 添加成功`);
        navigate('/medications');
      } else {
        toast.error(result.error || '添加失败');
      }
    } catch (error) {
      console.error('添加药物失败:', error);
      toast.error('添加失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理扫码添加 - 模拟功能
  const handleScanAdd = () => {
    toast.info('扫码添加功能尚在开发中', {
      description: '即将支持扫描药盒条形码自动识别药品信息，敬请期待'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* 顶部导航 */}
      <div className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/medications')}
          className="mr-2"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1">添加药物</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* 扫码添加按钮 */}
        <Card 
          className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 cursor-pointer hover:shadow-md transition-all"
          onClick={handleScanAdd}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <ScanLine className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 mb-1">扫码添加药品</h3>
              <p className="text-sm text-gray-500">扫描药盒条形码快速识别药品信息</p>
            </div>
            <div className="px-3 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
              开发中
            </div>
          </div>
        </Card>

        {/* 分隔线 */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-sm text-gray-400">或手动添加</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* 表单区域 */}
        <Card className="p-6">
          <MedicationForm 
            onSubmit={handleSubmit}
            onCancel={() => navigate('/medications')}
          />
        </Card>

        {/* 温馨提示 */}
        <Alert className="bg-blue-50 border-blue-200">
          <Pill className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-700 text-sm">
            添加药物后，系统会根据您设置的频次自动生成服药计划。记得设置库存数量，以便及时收到补货提醒。
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};

export default AddMedication;
