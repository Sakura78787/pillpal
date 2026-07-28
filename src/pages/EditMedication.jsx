import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import MedicationForm from '@/components/medications/MedicationForm';
import { useAuthStore } from '@/store/authStore';
import { useMedicationStore } from '@/store/medicationStore';

/**
 * 编辑药物页面
 * 关键修复：确保正确加载药物数据并回填到表单
 */
const EditMedication = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuthStore();
  const { medications, loadLocalMedications, updateMedication, getMedicationById } = useMedicationStore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [medicationData, setMedicationData] = useState(null);

  // 关键修复：加载药物数据
  useEffect(() => {
    const loadMedication = async () => {
      if (!user?.id || !id) return;
      
      setIsLoading(true);
      try {
        // 先尝试从store中获取
        const existingMed = medications.find(m => String(m.id) === String(id));
        
        if (existingMed) {
          console.log('[EditMedication] 从store加载药物数据:', existingMed);
          setMedicationData(existingMed);
        } else {
          // 如果store中没有，尝试从数据库获取
          const med = await getMedicationById(id);
          if (med) {
            console.log('[EditMedication] 从数据库加载药物数据:', med);
            setMedicationData(med);
          } else {
            toast.error('药物不存在');
            navigate('/medications');
            return;
          }
        }
      } catch (error) {
        console.error('[EditMedication] 加载药物数据失败:', error);
        toast.error('加载药物数据失败');
      } finally {
        setIsLoading(false);
      }
    };

    loadMedication();
  }, [id, user, medications, getMedicationById, navigate]);

  // 处理表单提交
  const handleSubmit = async (formData) => {
    if (!user?.id || !id) {
      toast.error('请先登录');
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('[EditMedication] 提交更新:', formData);
      
      const result = await updateMedication(id, formData);

      if (result.success) {
        toast.success('药物更新成功');
        navigate('/medications');
      } else {
        toast.error(result.error || '更新失败');
      }
    } catch (error) {
      console.error('[EditMedication] 更新失败:', error);
      toast.error('更新失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理取消
  const handleCancel = () => {
    navigate('/medications');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-3" />
          <p className="text-gray-500">加载药物信息...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* 顶部导航 */}
      <div className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancel}
          className="mr-2"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1">编辑药物</h1>
      </div>

      {/* 内容区域 */}
      <div className="px-4 py-4">
        <Card className="p-4 mb-4 bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-800">
            修改药物信息，系统将自动更新您的用药计划。
            <br />
            已保存的服药记录不会受到影响。
          </p>
        </Card>

        {medicationData ? (
          <MedicationForm
            initialData={medicationData}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isEditMode={true}
          />
        ) : (
          <Card className="p-8 text-center">
            <p className="text-gray-500">药物信息加载失败</p>
            <Button 
              onClick={() => navigate('/medications')} 
              className="mt-4 bg-green-600 hover:bg-green-700"
            >
              返回用药计划
            </Button>
          </Card>
        )}
      </div>

      {/* 提交中遮罩 */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-3" />
            <p className="text-gray-700">保存中...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditMedication;
