import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Package, 
  AlertTriangle, 
  ChevronDown, 
  Loader2,
  ArrowUpDown,
  Filter,
  Pill,
  RefreshCw,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import StockManager from '@/components/inventory/StockManager';
import { useAuthStore } from '@/store/authStore';
import { useMedicationStore } from '@/store/medicationStore';
import { useUIStore } from '@/store/uiStore';
import { useDefaultData, getDefaultMedications } from '@/hooks/useDefaultData';

/**
 * 库存总览页面
 * 展示所有药品库存状态，支持按状态分类筛选
 * 添加补货提示入口
 */
const Inventory = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { medications, loadLocalMedications, updateMedication, isLoading } = useMedicationStore();
  const { setPageTitle, setActiveTab } = useUIStore();
  const { hasRealData, markHasRealData } = useDefaultData('inventory');

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('days'); // days, name, stock
  const [activeFilter, setActiveFilter] = useState('all'); // all, critical, low, adequate
  const [stockManagerOpen, setStockManagerOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState(null);
  const [displayMedications, setDisplayMedications] = useState([]);

  // 设置页面标题
  useEffect(() => {
    setPageTitle('库存管理');
    setActiveTab('inventory');
  }, [setPageTitle, setActiveTab]);

  // 加载数据
  useEffect(() => {
    if (user?.id) {
      loadLocalMedications(user.id);
    }
  }, [user, loadLocalMedications]);

  // 合并默认数据和真实数据
  useEffect(() => {
    const realMeds = medications.filter(m => !m.is_demo && m.status === 'active');
    const hasAnyReal = realMeds.length > 0;
    
    if (hasAnyReal && !hasRealData) {
      markHasRealData();
    }
    
    if (!hasRealData && medications.filter(m => m.status === 'active').length === 0) {
      // 显示默认数据
      setDisplayMedications(getDefaultMedications(user?.id || 'guest').map(m => ({
        ...m,
        stockStatus: calculateStockStatus(m),
        perDose: calculatePerDose(m)
      })));
    } else {
      setDisplayMedications(medications.filter(m => m.status === 'active').map(m => ({
        ...m,
        stockStatus: calculateStockStatus(m),
        perDose: calculatePerDose(m)
      })));
    }
  }, [medications, hasRealData, user, markHasRealData]);

  // 计算库存状态 - 自定义频次返回特殊状态
  const calculateStockStatus = (med) => {
    // 自定义频次不显示库存状态
    if (med.frequency_type === 'custom') {
      return { 
        status: 'custom', 
        label: '按需', 
        color: 'blue',
        days: null,
        isCustom: true
      };
    }
    
    if (!med || med.stock_quantity <= 0) {
      return { status: 'empty', label: '已耗尽', color: 'red', days: 0 };
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
      return { status: 'unknown', label: '未知', color: 'gray', days: 0 };
    }

    const daysRemaining = Math.floor(stock / dailyConsumption);

    if (daysRemaining <= 0) {
      return { status: 'empty', label: '已耗尽', color: 'red', days: 0 };
    } else if (daysRemaining <= 3) {
      return { status: 'critical', label: '告急', color: 'red', days: daysRemaining };
    } else if (daysRemaining <= threshold) {
      return { status: 'low', label: '不足', color: 'yellow', days: daysRemaining };
    } else {
      return { status: 'adequate', label: '充足', color: 'green', days: daysRemaining };
    }
  };

  // 计算每次消耗量
  const calculatePerDose = (med) => {
    return `${med.dosage || 1}${med.unit || '片'}/次`;
  };

  // 关键修复：统计各状态数量 - "全部"包含自定义频次，其他三个排除
  const stats = useMemo(() => {
    // 所有活跃药物（包含自定义频次）
    const allActiveMeds = displayMedications.filter(med => med.status === 'active' || med.is_demo);
    // 非自定义频次的活跃药物（用于告急/不足/充足统计）
    const nonCustomMeds = allActiveMeds.filter(med => med.frequency_type !== 'custom');
    
    const withStatus = nonCustomMeds.map(med => ({
      ...med,
      stockStatus: calculateStockStatus(med)
    }));
    
    return {
      total: allActiveMeds.length, // 包含自定义频次
      critical: withStatus.filter(m => m.stockStatus.status === 'critical').length,
      low: withStatus.filter(m => m.stockStatus.status === 'low' || m.stockStatus.status === 'empty').length,
      adequate: withStatus.filter(m => m.stockStatus.status === 'adequate').length
    };
  }, [displayMedications]);

  // 处理补货入口
  const handleRefill = (medication) => {
    toast.info('补货记录功能后续接入', {
      description: `当前可先手动更新 ${medication.name} 的库存数量`
    });
  };

  // 处理库存药品数据
  const processedMeds = useMemo(() => {
    return displayMedications
      .filter(med => med.status === 'active' || med.is_demo)
      .map(med => ({
        ...med,
        stockStatus: calculateStockStatus(med),
        perDose: calculatePerDose(med)
      }))
      .filter(med => {
        // 搜索过滤
        const matchesSearch = med.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        // 状态过滤 - 自定义频次单独处理
        if (activeFilter === 'all') return matchesSearch;
        if (activeFilter === 'critical') return matchesSearch && med.stockStatus.status === 'critical';
        if (activeFilter === 'low') return matchesSearch && (med.stockStatus.status === 'low' || med.stockStatus.status === 'empty');
        if (activeFilter === 'adequate') return matchesSearch && med.stockStatus.status === 'adequate';
        
        return matchesSearch;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'days':
            // 自定义频次排到最后
            if (a.stockStatus.isCustom && !b.stockStatus.isCustom) return 1;
            if (!a.stockStatus.isCustom && b.stockStatus.isCustom) return -1;
            if (a.stockStatus.isCustom && b.stockStatus.isCustom) return 0;
            return (a.stockStatus.days || 0) - (b.stockStatus.days || 0);
          case 'name':
            return a.name.localeCompare(b.name);
          case 'stock':
            return (a.stock_quantity || 0) - (b.stock_quantity || 0);
          default:
            return 0;
        }
      });
  }, [displayMedications, searchQuery, sortBy, activeFilter]);

  // 打开库存管理器
  const handleManageStock = (medication) => {
    if (medication.is_demo) {
      toast.info('示例数据无法编辑，请先添加真实用药计划');
      return;
    }
    setSelectedMed(medication);
    setStockManagerOpen(true);
  };

  // 更新库存
  const handleUpdateStock = async (updatedMed) => {
    const result = await updateMedication(updatedMed.id, {
      stock_quantity: updatedMed.stock_quantity
    });

    if (result.success) {
      toast.success(`${updatedMed.name} 库存已更新`);
      setStockManagerOpen(false);
      setSelectedMed(null);
    } else {
      toast.error('更新失败，请重试');
    }
  };

  // 获取预警药品（用于补货提示）
  const warningMeds = processedMeds.filter(med => 
    (med.stockStatus.status === 'critical' || med.stockStatus.status === 'empty') && !med.stockStatus.isCustom
  );

  // 是否有示例数据
  const hasDemoData = displayMedications.some(m => m.is_demo);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 顶部导航 */}
      <div className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm">
        <h1 className="text-lg font-semibold mb-3">库存管理</h1>
        
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜索药品名称..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      <div className="px-4 py-4">
        {/* 示例数据提示 */}
        {hasDemoData && !hasRealData && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">以下是示例数据</p>
              <p className="text-amber-700">添加真实用药计划后，库存数据会自动计算显示</p>
            </div>
          </div>
        )}

        {/* 补货提示卡片（当有需要补货的药品时显示） */}
        {warningMeds.length > 0 && (
          <Card className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Pill className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-amber-900 mb-1">
                    有 {warningMeds.length} 种药品需要补充
                  </h3>
                  <p className="text-sm text-amber-700 mb-3">
                    {warningMeds.slice(0, 2).map(m => m.name).join('、')}
                    {warningMeds.length > 2 && `等${warningMeds.length}种药品`}
                    库存不足，建议及时补货
                  </p>
                  <Button 
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => toast.info('补货记录功能后续接入', {
                      description: '本阶段仅做库存预警和手动库存管理'
                    })}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    记录补货
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <Card 
            className={`p-3 cursor-pointer transition-all ${activeFilter === 'all' ? 'ring-2 ring-green-500 bg-green-50' : 'hover:bg-gray-50'}`}
            onClick={() => setActiveFilter('all')}
          >
            <p className="text-xs text-gray-500 mb-1">全部</p>
            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
          </Card>
          <Card 
            className={`p-3 cursor-pointer transition-all ${activeFilter === 'critical' ? 'ring-2 ring-red-500 bg-red-50' : 'hover:bg-gray-50'}`}
            onClick={() => setActiveFilter('critical')}
          >
            <p className="text-xs text-red-600 mb-1">告急</p>
            <p className="text-xl font-bold text-red-600">{stats.critical}</p>
          </Card>
          <Card 
            className={`p-3 cursor-pointer transition-all ${activeFilter === 'low' ? 'ring-2 ring-yellow-500 bg-yellow-50' : 'hover:bg-gray-50'}`}
            onClick={() => setActiveFilter('low')}
          >
            <p className="text-xs text-yellow-600 mb-1">不足</p>
            <p className="text-xl font-bold text-yellow-600">{stats.low}</p>
          </Card>
          <Card 
            className={`p-3 cursor-pointer transition-all ${activeFilter === 'adequate' ? 'ring-2 ring-green-500 bg-green-50' : 'hover:bg-gray-50'}`}
            onClick={() => setActiveFilter('adequate')}
          >
            <p className="text-xs text-green-600 mb-1">充足</p>
            <p className="text-xl font-bold text-green-600">{stats.adequate}</p>
          </Card>
        </div>

        {/* 筛选标签 */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          <Badge 
            variant={activeFilter === 'all' ? 'default' : 'outline'}
            className={`cursor-pointer whitespace-nowrap ${activeFilter === 'all' ? 'bg-green-600' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            全部药品
          </Badge>
          <Badge 
            variant={activeFilter === 'critical' ? 'default' : 'outline'}
            className={`cursor-pointer whitespace-nowrap ${activeFilter === 'critical' ? 'bg-red-600' : ''}`}
            onClick={() => setActiveFilter('critical')}
          >
            <AlertTriangle className="w-3 h-3 mr-1" />
            告急
          </Badge>
          <Badge 
            variant={activeFilter === 'low' ? 'default' : 'outline'}
            className={`cursor-pointer whitespace-nowrap ${activeFilter === 'low' ? 'bg-yellow-600' : ''}`}
            onClick={() => setActiveFilter('low')}
          >
            不足
          </Badge>
          <Badge 
            variant={activeFilter === 'adequate' ? 'default' : 'outline'}
            className={`cursor-pointer whitespace-nowrap ${activeFilter === 'adequate' ? 'bg-green-600' : ''}`}
            onClick={() => setActiveFilter('adequate')}
          >
            充足
          </Badge>
        </div>

        {/* 排序选项 */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500">
            共 {processedMeds.length} 种药品
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-gray-600"
            onClick={() => setSortBy(sortBy === 'days' ? 'name' : sortBy === 'name' ? 'stock' : 'days')}
          >
            <ArrowUpDown className="w-4 h-4 mr-1" />
            {sortBy === 'days' ? '按剩余天数' : sortBy === 'name' ? '按名称' : '按库存量'}
          </Button>
        </div>

        {/* 药品列表 */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-3" />
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : processedMeds.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-2">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || activeFilter !== 'all' ? '未找到匹配的药品' : '暂无药品库存数据'}
            </h3>
            <p className="text-sm text-gray-500">
              {searchQuery || activeFilter !== 'all' 
                ? '请尝试其他筛选条件' 
                : '添加用药计划后会自动显示库存信息'}
            </p>
            {(searchQuery || activeFilter !== 'all') && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => {
                  setSearchQuery('');
                  setActiveFilter('all');
                }}
              >
                清除筛选
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {processedMeds.map((med) => (
              <Card 
                key={med.id} 
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div 
                  className="flex items-center justify-between"
                  onClick={() => handleManageStock(med)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{med.name}</h3>
                      {/* 自定义频次显示特殊标签 */}
                      {med.stockStatus.isCustom ? (
                        <Badge className="bg-blue-100 text-blue-800">按需</Badge>
                      ) : (
                        <Badge className={
                          med.stockStatus.color === 'red' ? 'bg-red-100 text-red-800' :
                          med.stockStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }>
                          {med.stockStatus.label}
                        </Badge>
                      )}
                      {med.is_demo && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                          示例
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>当前库存: <strong className="text-gray-900">{med.stock_quantity}{med.unit}</strong></span>
                      {/* 自定义频次不显示预计可用天数 */}
                      {!med.stockStatus.isCustom && (
                        <>
                          <span>·</span>
                          <span>每次消耗: {med.perDose}</span>
                          <span>·</span>
                          <span className={
                            med.stockStatus.color === 'red' ? 'text-red-600 font-medium' :
                            med.stockStatus.color === 'yellow' ? 'text-yellow-600' :
                            'text-green-600'
                          }>
                            预计可用{med.stockStatus.days}天
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </div>
                
                {/* 库存告急时显示补货按钮 */}
                {(med.stockStatus.status === 'critical' || med.stockStatus.status === 'empty') && !med.stockStatus.isCustom && (
                  <div className="mt-3 pt-3 border-t flex justify-end">
                    <Button 
                      size="sm"
                      variant="outline"
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRefill(med);
                      }}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      补货
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 库存管理器 */}
      <StockManager
        isOpen={stockManagerOpen}
        onClose={() => {
          setStockManagerOpen(false);
          setSelectedMed(null);
        }}
        medication={selectedMed}
        onUpdate={handleUpdateStock}
      />
    </div>
  );
};

export default Inventory;
