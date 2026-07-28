import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  CheckCircle2, 
  XCircle, 
  MoreHorizontal,
  Edit3,
  Trash2,
  Stethoscope
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 复诊预约列表组件
 * 支持编辑按钮单独显示
 */
const AppointmentList = ({ 
  appointments = [], 
  onEdit, 
  onComplete, 
  onCancel, 
  onDelete,
  emptyMessage = '暂无复诊预约',
  showEditButton = false
}) => {
  // 获取状态徽章
  const getStatusBadge = (status) => {
    switch (status) {
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-800">待复诊</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">已完成</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800">已取消</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">未知</Badge>;
    }
  };

  // 空状态
  if (appointments.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((appointment) => (
        <Card key={appointment.id} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {/* 医院和时间 */}
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-gray-900 truncate">
                  {appointment.hospital_name}
                </h3>
                {getStatusBadge(appointment.status)}
                {appointment.is_demo && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    示例
                  </Badge>
                )}
              </div>
              
              {/* 科室和医生 */}
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                <span className="flex items-center gap-1">
                  <Stethoscope className="w-4 h-4" />
                  {appointment.department}
                </span>
                {appointment.doctor_name && (
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {appointment.doctor_name}
                  </span>
                )}
              </div>
              
              {/* 日期时间 */}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(parseISO(appointment.appointment_date), 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
                </span>
                {appointment.appointment_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {appointment.appointment_time.slice(0, 5)}
                  </span>
                )}
              </div>

              {/* 检查项目 */}
              {appointment.checkup_items && appointment.checkup_items.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {appointment.checkup_items.map((item, index) => (
                    <span 
                      key={index}
                      className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}

              {/* 备注 */}
              {appointment.notes && (
                <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                  备注：{appointment.notes}
                </p>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-1 ml-2">
              {/* 单独显示编辑按钮 */}
              {showEditButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit?.(appointment)}
                >
                  <Edit3 className="w-4 h-4 text-gray-500" />
                </Button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-4 h-4 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* 编辑选项 - 仅在未单独显示编辑按钮时显示 */}
                  {!showEditButton && (
                    <DropdownMenuItem onClick={() => onEdit?.(appointment)}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      编辑
                    </DropdownMenuItem>
                  )}
                  
                  {appointment.status === 'scheduled' && (
                    <>
                      <DropdownMenuItem onClick={() => onComplete?.(appointment)}>
                        <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                        标记完成
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCancel?.(appointment)}>
                        <XCircle className="w-4 h-4 mr-2 text-amber-600" />
                        取消预约
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem 
                    onClick={() => onDelete?.(appointment)}
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
      ))}
    </div>
  );
};

export default AppointmentList;
