import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, Calendar, CheckCircle2, XCircle, Clock, AlertCircle, Edit3, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import AppointmentList from '@/components/appointments/AppointmentList';
import AppointmentForm from '@/components/appointments/AppointmentForm';
import { useAuthStore } from '@/store/authStore';
import { useAppointmentStore } from '@/store/appointmentStore';
import { useUIStore } from '@/store/uiStore';
import { useDefaultData, getDefaultAppointments } from '@/hooks/useDefaultData';

/**
 * 复诊中心页面
 * 管理复诊预约列表，支持添加、编辑、完成、取消等操作
 */
const Appointments = () => {
  const navigate = useNavigate();
  const { user, authStatus } = useAuthStore();
  const { 
    appointments, 
    loadLocalAppointments, 
    addAppointment, 
    updateAppointment,
    completeAppointment,
    cancelAppointment,
    deleteAppointment,
    isLoading 
  } = useAppointmentStore();
  const { setActiveTab, setPageTitle } = useUIStore();
  const { hasRealData, markHasRealData } = useDefaultData('appointments');

  const [activeStatus, setActiveStatus] = useState('scheduled');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayAppointments, setDisplayAppointments] = useState([]);

  // 设置页面标题
  useEffect(() => {
    setPageTitle('复诊中心');
    setActiveTab('appointments');
  }, [setPageTitle, setActiveTab]);

  // 检查登录状态
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      navigate('/login');
    }
  }, [authStatus, navigate]);

  // 加载数据
  useEffect(() => {
    if (user?.id) {
      loadLocalAppointments(user.id);
    }
  }, [user]);

  // 合并默认数据和真实数据
  useEffect(() => {
    const realAppointments = appointments.filter(a => !a.is_demo);
    const hasAnyReal = realAppointments.length > 0;
    
    if (hasAnyReal && !hasRealData) {
      markHasRealData();
    }
    
    if (!hasRealData && appointments.length === 0) {
      // 显示默认数据
      setDisplayAppointments(getDefaultAppointments(user?.id || 'guest'));
    } else {
      setDisplayAppointments(appointments);
    }
  }, [appointments, hasRealData, user, markHasRealData]);

  // 按状态分组预约
  const scheduledAppointments = displayAppointments.filter(a => a.status === 'scheduled' && !a.is_demo);
  const completedAppointments = displayAppointments.filter(a => a.status === 'completed' && !a.is_demo);
  const cancelledAppointments = displayAppointments.filter(a => a.status === 'cancelled' && !a.is_demo);
  const demoAppointments = displayAppointments.filter(a => a.is_demo);

  // 获取统计
  const stats = {
    scheduled: scheduledAppointments.length,
    completed: completedAppointments.length,
    cancelled: cancelledAppointments.length,
    total: appointments.filter(a => !a.is_demo).length
  };

  // 打开添加表单
  const handleAdd = () => {
    setEditingAppointment(null);
    setIsFormOpen(true);
  };

  // 打开编辑表单
  const handleEdit = (appointment) => {
    if (appointment.is_demo) {
      toast.info('示例数据无法编辑，请先添加真实复诊记录');
      return;
    }
    setEditingAppointment(appointment);
    setIsFormOpen(true);
  };

  // 提交表单
  const handleSubmit = async (formData) => {
    if (!user?.id) return;
    
    setIsSubmitting(true);
    try {
      if (editingAppointment) {
        // 更新现有预约
        const result = await updateAppointment(editingAppointment.id, formData);
        if (result.success) {
          toast.success('复诊预约已更新');
          setIsFormOpen(false);
          setEditingAppointment(null);
        } else {
          toast.error(result.error || '更新失败');
        }
      } else {
        // 添加新预约
        const result = await addAppointment(user.id, formData);
        if (result.success) {
          toast.success('复诊预约已添加');
          markHasRealData();
          setIsFormOpen(false);
        } else {
          toast.error(result.error || '添加失败');
        }
      }
    } catch (error) {
      toast.error('操作失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 标记完成
  const handleComplete = async (appointment) => {
    if (appointment.is_demo) {
      toast.info('示例数据无法操作，请先添加真实复诊记录');
      return;
    }
    try {
      const result = await completeAppointment(appointment.id, {
        completed_at: new Date().toISOString()
      });
      if (result.success) {
        toast.success('已标记为完成');
      } else {
        toast.error(result.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败，请重试');
    }
  };

  // 取消预约
  const handleCancel = async (appointment) => {
    if (appointment.is_demo) {
      toast.info('示例数据无法操作，请先添加真实复诊记录');
      return;
    }
    try {
      const result = await cancelAppointment(appointment.id, '用户取消');
      if (result.success) {
        toast.success('预约已取消');
      } else {
        toast.error(result.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败，请重试');
    }
  };

  // 删除预约
  const handleDelete = async (appointment) => {
    if (appointment.is_demo) {
      toast.info('示例数据无法删除');
      return;
    }
    if (!confirm('确定要删除这个复诊预约吗？')) return;
    
    try {
      const result = await deleteAppointment(appointment.id);
      if (result.success) {
        toast.success('预约已删除');
      } else {
        toast.error(result.error || '删除失败');
      }
    } catch (error) {
      toast.error('删除失败，请重试');
    }
  };

  // 关闭表单
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingAppointment(null);
  };

  if (isLoading && appointments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
          <p className="text-gray-500">加载复诊预约...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 顶部统计卡片 */}
      <div className="bg-white px-4 pt-4 pb-6 rounded-b-3xl shadow-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-4">复诊中心</h1>
        
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 bg-blue-50 border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-gray-600">待复诊</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.scheduled}</p>
          </Card>
          
          <Card className="p-3 bg-green-50 border-green-100">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-600">已完成</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </Card>
          
          <Card className="p-3 bg-gray-50 border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-600">已取消</span>
            </div>
            <p className="text-2xl font-bold text-gray-600">{stats.cancelled}</p>
          </Card>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="px-4 py-4">
        {/* 示例数据提示 */}
        {demoAppointments.length > 0 && !hasRealData && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">以下是示例数据</p>
              <p className="text-amber-700">点击"添加复诊"创建您的真实复诊记录</p>
            </div>
          </div>
        )}

        {/* 添加复诊大按钮 - 当没有真实数据时显示 */}
        {stats.scheduled === 0 && (
          <Card className="p-8 text-center border-dashed border-2 border-blue-200 bg-blue-50/50 mb-6">
            <Calendar className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">还没有复诊预约</h3>
            <p className="text-sm text-gray-500 mb-4">添加您的复诊计划，不再错过重要检查</p>
            <Button 
              onClick={handleAdd}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-6 text-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              添加复诊
            </Button>
          </Card>
        )}

        <Tabs value={activeStatus} onValueChange={setActiveStatus}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="scheduled" className="text-sm">
              待复诊 ({stats.scheduled})
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-sm">
              已完成 ({stats.completed})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="text-sm">
              已取消 ({stats.cancelled})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled">
            <AppointmentList
              appointments={[...scheduledAppointments, ...demoAppointments.filter(a => a.status === 'scheduled')]}
              onEdit={handleEdit}
              onComplete={handleComplete}
              onCancel={handleCancel}
              onDelete={handleDelete}
              emptyMessage="暂无待复诊预约"
              showEditButton={true}
            />
          </TabsContent>

          <TabsContent value="completed">
            <AppointmentList
              appointments={completedAppointments}
              onEdit={handleEdit}
              onDelete={handleDelete}
              emptyMessage="暂无已完成复诊"
              showEditButton={true}
            />
          </TabsContent>

          <TabsContent value="cancelled">
            <AppointmentList
              appointments={cancelledAppointments}
              onEdit={handleEdit}
              onDelete={handleDelete}
              emptyMessage="暂无已取消复诊"
              showEditButton={true}
            />
          </TabsContent>
        </Tabs>

        {/* 功能指引 */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            操作指南
          </h4>
          <div className="space-y-2 text-sm text-gray-600">
            <p className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-gray-400" />
              点击卡片上的编辑图标可修改复诊信息
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              复诊完成后点击勾选标记为已完成
            </p>
            <p className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-400" />
              点击删除图标可删除不需要的预约
            </p>
            <p className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              复诊前3天会在应用内显示提醒
            </p>
          </div>
        </div>
      </div>

      {/* 悬浮添加按钮 */}
      <Button
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg"
        onClick={handleAdd}
      >
        <Plus className="w-6 h-6" />
      </Button>

      {/* 预约表单弹窗 */}
      <AppointmentForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        initialData={editingAppointment}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
      />
    </div>
  );
};

export default Appointments;
