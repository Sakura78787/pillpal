import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Loader2, 
  AlertCircle, 
  MoreHorizontal,
  Play,
  Pause,
  Trash2,
  Edit3,
  Package,
  RotateCcw,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useAuthStore } from '@/store/authStore';
import { useMedicationStore } from '@/store/medicationStore';
import { useUIStore } from '@/store/uiStore';
import { useDefaultData, getDefaultMedications } from '@/hooks/useDefaultData';
import DeletedMedications from '@/components/settings/DeletedMedications';

/**
 * 用药计划列表页面
 * 展示所有用药计划，支持搜索、筛选、编辑、删除
 */
const Medications = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    medications, 
    loadLocalMedications, 
    updateMedication,
    deleteMedication,
    isLoading 
  } = useMedicationStore();
  const { setActiveTab, setPageTitle } = useUIStore();
  const { hasRealData, markHasRealData } = useDefaultData('medications');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState(null);
  const [displayMedications, setDisplayMedications] = useState([]);
  const [showDeletedMeds, setShowDeletedMeds] = useState(false);

  // 设置页面标题
  useEffect(() => {
    setPageTitle('用药计划');
    setActiveTab('medications');
  }, [setPageTitle, setActiveTab]);

  // 加载数据
  useEffect(() => {
    if (user?.id) {
      loadLocalMedications(user.id);
    }
  }, [user, loadLocalMedications]);

  // 合并默认数据和真实数据
  useEffect(() => {
    const realMeds = medications.filter(m => !m.is_demo && m.status !== 'deleted');
    const hasAnyReal = realMeds.length > 0;
    
    if (hasAnyReal && !hasRealData) {
      markHasRealData();
    }
    
    if (!hasRealData && medications.filter(m => m.status !== 'deleted').length === 0) {
      // 显示默认数据
      setDisplayMedications(getDefaultMedications(user?.id || 'guest'));
    } else {
      setDisplayMedications(medications.filter(m => m.status !== 'deleted'));
    }
  }, [medications, hasRealData, user, markHasRealData]);

  // 过滤药物列表
  const filteredMedications = displayMedications.filter(med => {
    const matchesSearch = med.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeFilter === 'all') return matchesSearch && med.status !== 'deleted';
    if (activeFilter === 'active') return matchesSearch && med.status === 'active';
    if (activeFilter === 'paused') return matchesSearch && med.status === 'paused';
    
    return matchesSearch && med.status !== 'deleted';
  });

  // 计算库存状态 - 自定义频次返回特殊状态
  const calculateStockStatus = (med) => {
    // 自定义频次不显示库存状态
    if (med.frequency_type === 'custom') {
      return { status: 'custom', label: '按需', color: 'blue' };
    }
    
    if (!med || med.stock_quantity <= 0) {
      return { status: 'empty', label: '已耗尽', color: 'red' };
    }

    const dosage = parseFloat(med.dosage) || 1;
    const stock = med.stock_quantity;
    const threshold = med.low_stock_threshold || 7;
    
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
      return { status: 'unknown', label: '未知', color: 'gray' };
    }

    const daysRemaining = Math.floor(stock / dailyConsumption);

    if (daysRemaining <= 0) {
      return { status: 'empty', label: '已耗尽', color: 'red' };
    } else if (daysRemaining <= 3) {
      return { status: 'critical', label: `告急(${daysRemaining}天)`, color: 'red' };
    } else if (daysRemaining <= threshold) {
      return { status: 'low', label: `不足(${daysRemaining}天)`, color: 'yellow' };
    } else {
      return { status: 'adequate', label: `充足(${daysRemaining}天)`, color: 'green' };
    }
  };

  // 获取频次描述
  const getFrequencyDesc = (med) => {
    if (!med) return '定期服用';
    
    const freqType = med.frequency_type;
    const freqConfig = med.frequency_config || {};
    const dosage = med.dosage || 1;
    const unit = med.unit || '片';
    
    if (freqType === 'custom') {
      return freqConfig.customDesc || '按需服用';
    }
    
    switch (freqType) {
      case 'daily':
        const times = freqConfig.dailyTimes || 1;
        return `每日${times}次，每次${dosage}${unit}`;
      case 'weekly':
        const days = freqConfig.weeklyDays || [];
        if (days.length === 0) return '每周服用';
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        const dayLabels = days.map(d => dayNames[d]).join('、');
        return `每周${dayLabels}，每次${dosage}${unit}`;
      case 'interval':
        const interval = freqConfig.intervalDays || 2;
        return `每${interval}天一次，每次${dosage}${unit}`;
      default:
        return '定期服用';
    }
  };

  // 处理暂停/恢复
  const handleToggleStatus = async (med) => {
    if (med.is_demo) {
      toast.info('示例数据无法编辑，请先添加真实用药计划');
      return;
    }
    const newStatus = med.status === 'active' ? 'paused' : 'active';
    const result = await updateMedication(med.id, { status: newStatus });
    
    if (result.success) {
      toast.success(`${med.name} 已${newStatus === 'active' ? '恢复' : '暂停'}`);
    } else {
      toast.error('操作失败');
    }
  };

  // 处理删除
  const handleDelete = (med) => {
    if (med.is_demo) {
      toast.info('示例数据无法删除');
      return;
    }
    setSelectedMed(med);
    setDeleteDialogOpen(true);
  };

  // 确认删除
  const confirmDelete = async () => {
    if (!selectedMed) return;
    
    const result = await deleteMedication(selectedMed.id);
    
    if (result.success) {
      toast.success(`${selectedMed.name} 已删除`);
      setDeleteDialogOpen(false);
      setSelectedMed(null);
    } else {
      toast.error('删除失败');
    }
  };

  // 处理编辑
  const handleEdit = (med) => {
    if (med.is_demo) {
      toast.info('示例数据无法编辑，请先添加真实用药计划');
      return;
    }
    navigate(`/medications/edit/${med.id}`);
  };

  // 获取状态徽章
  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">服用中</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">已暂停</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">未知</Badge>;
    }
  };

  // 显示已删除药物页面
  if (showDeletedMeds) {
    return (
      <div className="min-h-screen bg-gray-50 pb-6">
        <div className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDeletedMeds(false)}
            className="mr-2"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </Button>
          <h1 className="text-lg font-semibold flex-1">已删除药物</h1>
        </div>
        <div className="px-4 pt-4">
          <DeletedMedications />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 顶部导航 */}
      <div className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm">
        <h1 className="text-lg font-semibold mb-3">用药计划</h1>
        
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜索药物名称..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      {/* 内容区域 */}
      <div className="px-4 py-4">
        {/* 示例数据提示 */}
        {!hasRealData && medications.filter(m => m.status !== 'deleted').length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">以下是示例数据</p>
              <p className="text-amber-700">点击右下角按钮添加您的真实用药计划</p>
            </div>
          </div>
        )}

        {/* 添加药物大按钮 - 当没有真实数据时显示 */}
        {!hasRealData && medications.filter(m => m.status !== 'deleted').length === 0 && (
          <Card className="p-8 text-center border-dashed border-2 border-green-200 bg-green-50/50 mb-6">
            <Package className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">还没有用药计划</h3>
            <p className="text-sm text-gray-500 mb-4">添加您的第一种药物，开始规律用药管理</p>
            <Button 
              onClick={() => navigate('/medications/add')}
              className="bg-green-600 hover:bg-green-700 px-8 py-6 text-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              添加药物
            </Button>
          </Card>
        )}

        <Tabs value={activeFilter} onValueChange={setActiveFilter}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="active">服用中</TabsTrigger>
            <TabsTrigger value="paused">已暂停</TabsTrigger>
          </TabsList>

          <TabsContent value={activeFilter} className="mt-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-3" />
                <p className="text-gray-500">加载中...</p>
              </div>
            ) : filteredMedications.length === 0 ? (
              <Card className="p-8 text-center border-dashed border-2">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchQuery ? '未找到匹配的药物' : '还没有用药计划'}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {searchQuery 
                    ? '请尝试其他关键词搜索' 
                    : '添加您的第一种药物，开始规律用药管理'}
                </p>
                {!searchQuery && (
                  <Button 
                    onClick={() => navigate('/medications/add')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    添加药物
                  </Button>
                )}
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredMedications.map((med) => {
                  const stockStatus = calculateStockStatus(med);
                  const freqDesc = getFrequencyDesc(med);
                  const isCustom = med.frequency_type === 'custom';
                  
                  return (
                    <Card 
                      key={med.id} 
                      className={`p-4 hover:shadow-md transition-shadow ${
                        med.status === 'paused' ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {med.name}
                            </h3>
                            {getStatusBadge(med.status)}
                            {med.is_demo && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                示例
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-2">
                            {freqDesc}
                          </p>
                          
                          <div className="flex items-center gap-4 text-sm">
                            {/* 自定义频次只显示"按需"，不显示库存状态 */}
                            {isCustom ? (
                              <span className="text-blue-600 flex items-center gap-1">
                                <Package className="w-4 h-4" />
                                按需服用
                              </span>
                            ) : (
                              <span className={`flex items-center gap-1 ${
                                stockStatus.color === 'red' ? 'text-red-600' :
                                stockStatus.color === 'yellow' ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>
                                <Package className="w-4 h-4" />
                                库存{stockStatus.label}
                              </span>
                            )}
                            
                            {/* 自定义频次不显示提醒时间 */}
                            {!isCustom && med.reminder_times && med.reminder_times.length > 0 && (
                              <span className="text-gray-500">
                                提醒: {med.reminder_times.slice(0, 2).join(', ')}
                                {med.reminder_times.length > 2 && '...'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(med)}
                          >
                            <Edit3 className="w-4 h-4 text-gray-500" />
                          </Button>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4 text-gray-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleToggleStatus(med)}>
                                {med.status === 'active' ? (
                                  <>
                                    <Pause className="w-4 h-4 mr-2" />
                                    暂停服用
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-4 h-4 mr-2" />
                                    恢复服用
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(med)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* 功能指引 */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-green-600" />
            操作指南
          </h4>
          <div className="space-y-2 text-sm text-gray-600">
            <p className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-gray-400" />
              点击铅笔图标可编辑药物信息
            </p>
            <p className="flex items-center gap-2">
              <MoreHorizontal className="w-4 h-4 text-gray-400" />
              点击更多按钮可暂停/恢复或删除药物
            </p>
            <p className="flex items-center gap-2">
              <Pause className="w-4 h-4 text-yellow-500" />
              暂停的药物不会生成服药提醒
            </p>
            <p className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-blue-500" />
              误删的药物可在下方"已删除药物"中恢复
            </p>
          </div>
        </div>

        {/* 已删除药物入口 */}
        <Button 
          variant="outline" 
          className="w-full mt-4 justify-start text-gray-600 hover:text-amber-600 hover:bg-amber-50"
          onClick={() => setShowDeletedMeds(true)}
        >
          <RotateCcw className="w-4 h-4 mr-2 text-amber-600" />
          已删除药物（7天内可恢复）
          <ChevronRight className="w-4 h-4 ml-auto" />
        </Button>
      </div>

      {/* 悬浮添加按钮 */}
      <Button
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 shadow-lg z-40"
        onClick={() => navigate('/medications/add')}
      >
        <Plus className="w-6 h-6" />
      </Button>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该药物？</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedMed?.name}</strong> 将被删除，相关的服药记录将保留。
              <br />
              <span className="text-amber-600">
                删除后7天内可在下方"已删除药物"中恢复。
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedMed(null)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Medications;
