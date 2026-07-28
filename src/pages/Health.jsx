import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  ChevronLeft, 
  Loader2, 
  Download,
  Heart,
  Activity,
  TrendingUp,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import HealthCards from '@/components/health/HealthCards';
import RecordForm from '@/components/health/RecordForm';
import RecentList from '@/components/health/RecentList';
import { useAuthStore } from '@/store/authStore';
import { useHealthStore } from '@/store/healthStore';
import { useUIStore } from '@/store/uiStore';
import { useDefaultData, getDefaultHealthRecords, checkHealthValue } from '@/hooks/useDefaultData';

/**
 * 健康数据中心页面
 * 用户可以记录和查看血压、血糖、体重等健康指标
 */
const Health = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    records, 
    isLoading, 
    isSyncing,
    loadLocalRecords, 
    syncFromCloud,
    addRecord,
    deleteRecord
  } = useHealthStore();
  const { setPageTitle } = useUIStore();
  const { hasRealData, markHasRealData } = useDefaultData('health');

  const [activeTab, setActiveTab] = useState('overview');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayRecords, setDisplayRecords] = useState([]);
  const [healthWarnings, setHealthWarnings] = useState([]);

  // 设置页面标题
  useEffect(() => {
    setPageTitle('健康档案');
  }, [setPageTitle]);

  // 加载数据
  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user]);

  // 合并默认数据和真实数据
  useEffect(() => {
    const realRecords = records.filter(r => !r.is_demo);
    const hasAnyReal = realRecords.length > 0;
    
    if (hasAnyReal && !hasRealData) {
      markHasRealData();
    }
    
    if (!hasRealData && records.length === 0) {
      // 显示默认数据
      setDisplayRecords(getDefaultHealthRecords(user?.id || 'guest'));
    } else {
      setDisplayRecords(records);
    }
  }, [records, hasRealData, user, markHasRealData]);

  const loadData = async () => {
    try {
      // 加载本地记录
      await loadLocalRecords(user.id);
      
      // 同步云端数据（最近30天）
      await syncFromCloud(user.id, null, 30);
    } catch (error) {
      console.error('加载健康数据失败:', error);
      toast.error('数据加载失败');
    }
  };

  // 提交新记录
  const handleSubmit = async (formData) => {
    if (!user?.id) return;
    
    // 检查健康指标是否在正常范围
    const warnings = checkHealthValue(formData.record_type, formData.values);
    if (warnings.length > 0) {
      setHealthWarnings(warnings);
    } else {
      setHealthWarnings([]);
    }
    
    setIsSubmitting(true);
    try {
      const result = await addRecord(user.id, formData);
      
      if (result.success) {
        toast.success('记录已保存');
        markHasRealData();
        setShowAddDialog(false);
        
        // 如果有健康警告，显示提示
        if (warnings.length > 0) {
          setTimeout(() => {
            toast.warning('健康指标提醒', {
              description: warnings.join('；'),
              duration: 8000
            });
          }, 500);
        }
      } else {
        toast.error(result.error || '保存失败');
      }
    } catch (error) {
      toast.error('保存失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 删除记录
  const handleDelete = async (record) => {
    if (record.is_demo) {
      toast.info('示例数据无法删除');
      return;
    }
    try {
      const result = await deleteRecord(record.id);
      
      if (result.success) {
        toast.success('记录已删除');
      } else {
        toast.error('删除失败');
      }
    } catch (error) {
      toast.error('删除失败，请重试');
    }
  };

  // 导出数据（JSON格式）
  const handleExport = () => {
    const realRecords = displayRecords.filter(r => !r.is_demo);
    if (realRecords.length === 0) {
      toast.info('暂无数据可导出');
      return;
    }
    
    const dataStr = JSON.stringify(realRecords, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `health_records_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('数据导出成功');
  };

  // 计算最近7天有记录的天数
  const recentDaysCount = useMemo(() => {
    const realRecords = displayRecords.filter(r => !r.is_demo);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const uniqueDates = new Set();
    realRecords.forEach(record => {
      const recordDate = new Date(record.recorded_at);
      if (recordDate >= sevenDaysAgo) {
        uniqueDates.add(record.recorded_at.split('T')[0]);
      }
    });
    
    return uniqueDates.size;
  }, [displayRecords]);

  // 计算本周记录数
  const weeklyRecordCount = useMemo(() => {
    const realRecords = displayRecords.filter(r => !r.is_demo);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return realRecords.filter(record => {
      const recordDate = new Date(record.recorded_at);
      return recordDate >= sevenDaysAgo;
    }).length;
  }, [displayRecords]);

  // 是否有示例数据
  const hasDemoData = displayRecords.some(r => r.is_demo);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部导航 */}
      <div className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/profile')}
          className="mr-2"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1">健康档案</h1>
        {isSyncing && (
          <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleExport}
        >
          <Download className="w-5 h-5" />
        </Button>
      </div>

      {/* 内容区域 */}
      <div className="p-4 space-y-4">
        {/* 示例数据提示 */}
        {hasDemoData && !hasRealData && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">以下是示例数据</p>
              <p className="text-amber-700">点击下方"记一笔"添加您的真实健康记录</p>
            </div>
          </div>
        )}

        {/* 本周统计卡片 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600">本周记录</span>
            </div>
            <div className="text-2xl font-bold text-green-700">{weeklyRecordCount} 条</div>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600">记录天数</span>
            </div>
            <div className="text-2xl font-bold text-blue-700">{recentDaysCount} 天</div>
          </Card>
        </div>

        {/* 指标卡片 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="overview">指标概览</TabsTrigger>
            <TabsTrigger value="history">历史记录</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-4">
            {/* 最新指标卡片 */}
            <HealthCards records={displayRecords} />
            
            {/* 快速记录入口 */}
            <Card className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">记录健康数据</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    定期记录有助于追踪健康状况
                  </p>
                </div>
                <Button
                  onClick={() => setShowAddDialog(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  记一笔
                </Button>
              </div>
            </Card>

            {/* 健康标准提示 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                健康参考标准
              </p>
              <ul className="space-y-1 text-blue-700 text-xs">
                <li>• 正常血压：收缩压 90-120 mmHg，舒张压 60-80 mmHg</li>
                <li>• 正常心率：60-100 次/分</li>
                <li>• 空腹血糖：3.9-6.1 mmol/L</li>
                <li>• 餐后血糖：&lt;7.8 mmol/L</li>
                <li>• 健康BMI：18.5-24</li>
              </ul>
              {/* 医学免责声明 */}
              <p className="text-xs text-blue-600 mt-3 pt-2 border-t border-blue-200 leading-relaxed">
                以上均为健康成年人的通用参考标准，儿童、孕妇、老年人、有基础疾病的人群，需由医生根据个体情况制定个性化参考范围，不可直接套用。
              </p>
            </div>

            {/* 温馨提示 */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <p className="font-medium mb-1">💡 测量小贴士</p>
              <ul className="space-y-1 text-amber-700 text-xs">
                <li>• 血压测量前请静坐5分钟</li>
                <li>• 空腹血糖需在早餐前测量</li>
                <li>• 建议每天固定时间测量体重</li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <RecentList 
              records={displayRecords} 
              onDelete={handleDelete}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* 悬浮添加按钮 */}
      <Button
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 shadow-lg"
        onClick={() => setShowAddDialog(true)}
      >
        <Plus className="w-6 h-6" />
      </Button>

      {/* 添加记录弹窗 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-green-600" />
              记录健康数据
            </DialogTitle>
          </DialogHeader>
          <RecordForm
            onSubmit={handleSubmit}
            onCancel={() => setShowAddDialog(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Health;
