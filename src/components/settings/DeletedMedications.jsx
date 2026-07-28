import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Loader2, 
  AlertCircle, 
  RotateCcw, 
  Trash2, 
  Clock,
  Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useMedicationStore } from '@/store/medicationStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * 已删除药物管理组件
 * 展示7天内删除的药物，支持恢复和永久删除
 */
const DeletedMedications = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { medications, loadLocalMedications, restoreMedication } = useMedicationStore();
  
  const [deletedMeds, setDeletedMeds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState(null);

  // 加载已删除的药物
  useEffect(() => {
    loadDeletedMedications();
  }, [user?.id]);

  const loadDeletedMedications = async () => {
    setIsLoading(true);
    try {
      if (user?.id) {
        await loadLocalMedications(user.id);
      }
      
      // 过滤出7天内删除的药物
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const deleted = medications
        .filter(med => med.status === 'deleted')
        .filter(med => {
      const deletedAt = med.deleted_at || med.updated_at;
      if (!deletedAt) return true;
      const deletedTime = new Date(deletedAt).getTime();
          return deletedTime >= sevenDaysAgo.getTime();
        })
        .map(med => {
          const deletedTime = new Date(med.deleted_at || med.updated_at);
          const now = new Date();
          const hoursRemaining = Math.ceil((deletedTime.getTime() + 7 * 24 * 60 * 60 * 1000 - now.getTime()) / (1000 * 60 * 60));
          
          return {
            ...med,
            hoursRemaining: Math.max(0, hoursRemaining),
            daysRemaining: Math.ceil(hoursRemaining / 24)
          };
        })
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      
      setDeletedMeds(deleted);
    } catch (error) {
      console.error('加载已删除药物失败:', error);
      toast.error('加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 恢复药物
  const handleRestore = (med) => {
    setSelectedMed(med);
    setRestoreDialogOpen(true);
  };

  const confirmRestore = async () => {
    if (!selectedMed) return;
    
    const result = await restoreMedication(selectedMed.id);
    
    if (result.success) {
      toast.success(`${selectedMed.name} 已恢复`);
      setRestoreDialogOpen(false);
      setSelectedMed(null);
      // 刷新列表
      await loadDeletedMedications();
    } else {
      toast.error(result.error || '恢复失败');
    }
  };

  // 永久删除
  const handlePermanentDelete = (med) => {
    setSelectedMed(med);
    setPermanentDeleteDialogOpen(true);
  };

  const confirmPermanentDelete = async () => {
    if (!selectedMed) return;
    
    toast.info('永久删除本阶段未启用');
    setPermanentDeleteDialogOpen(false);
    setSelectedMed(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-3" />
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (deletedMeds.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed border-2">
        <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">没有已删除的药物</h3>
        <p className="text-sm text-gray-500 mb-4">
          删除的药物将在7天内显示在这里，您可以在此期间恢复它们
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium mb-1">7天恢复期限</p>
          <p className="text-amber-700">
            删除的药物可在7天内恢复，超过7天将自动永久删除。当前有 <strong>{deletedMeds.length}</strong> 个药物可恢复。
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {deletedMeds.map((med) => (
          <Card key={med.id} className="p-4 border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{med.name}</h3>
                  <Badge variant="secondary" className="bg-red-100 text-red-700">
                    已删除
                  </Badge>
                </div>
                
                <p className="text-sm text-gray-600 mb-2">
                  {med.dosage}{med.unit} · {med.frequency_type === 'custom' ? '按需服用' : '定期服用'}
                </p>
                
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {med.hoursRemaining <= 24 ? (
                    <span className="text-red-600 font-medium">
                      剩余 {med.hoursRemaining} 小时可恢复
                    </span>
                  ) : (
                    <span>
                      剩余 {med.daysRemaining} 天可恢复
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-green-600 text-green-600 hover:bg-green-50"
                  onClick={() => handleRestore(med)}
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  恢复
                </Button>
                
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handlePermanentDelete(med)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 恢复确认对话框 */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认恢复该药物？</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedMed?.name}</strong> 将恢复到用药计划中，相关的服药记录也将恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedMed(null)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmRestore}
              className="bg-green-600 hover:bg-green-700"
            >
              确认恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 永久删除确认对话框 */}
      <AlertDialog open={permanentDeleteDialogOpen} onOpenChange={setPermanentDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              确认永久删除？
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedMed?.name}</strong> 将被永久删除，无法恢复。
              <br /><br />
              <span className="text-red-600">
                此操作不可撤销，请谨慎操作！
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedMed(null)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmPermanentDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              永久删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DeletedMedications;
