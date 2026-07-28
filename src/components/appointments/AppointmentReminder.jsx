import { useEffect, useState } from 'react';
import { Calendar, Bell, ChevronRight, Building2, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays, isToday, isTomorrow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 复诊提醒组件
 * 在Dashboard显示即将到期的复诊提醒
 */
const AppointmentReminder = ({ 
  appointments = [], 
  onViewAll,
  maxDisplay = 2 
}) => {
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);

  useEffect(() => {
    // 筛选待复诊且需要提醒的预约
    const today = new Date();
    const filtered = appointments
      .filter(app => {
        if (app.status !== 'scheduled') return false;
        const appDate = parseISO(app.appointment_date);
        const daysUntil = differenceInDays(appDate, today);
        const reminderDays = app.reminder_days || 3;
        return daysUntil >= 0 && daysUntil <= reminderDays;
      })
      .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date))
      .slice(0, maxDisplay);
    
    setUpcomingAppointments(filtered);
  }, [appointments, maxDisplay]);

  // 获取提醒文本
  const getReminderText = (dateStr) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return { text: '今天', urgent: true };
    if (isTomorrow(date)) return { text: '明天', urgent: true };
    const days = differenceInDays(date, new Date());
    return { text: `${days}天后`, urgent: days <= 1 };
  };

  if (upcomingAppointments.length === 0) return null;

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 p-4 mb-4">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <Bell className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">复诊提醒</h3>
            <p className="text-xs text-gray-500">您有 {upcomingAppointments.length} 个即将到期的复诊</p>
          </div>
        </div>
        {appointments.length > maxDisplay && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-blue-600 hover:text-blue-700"
            onClick={onViewAll}
          >
            查看全部
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>

      {/* 提醒列表 */}
      <div className="space-y-2">
        {upcomingAppointments.map((appointment) => {
          const reminder = getReminderText(appointment.appointment_date);
          
          return (
            <div 
              key={appointment.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg",
                reminder.urgent ? "bg-white border border-blue-200" : "bg-blue-100/50"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    reminder.urgent 
                      ? "bg-red-100 text-red-700" 
                      : "bg-blue-200 text-blue-700"
                  )}>
                    {reminder.text}
                  </span>
                  {appointment.is_first_visit && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      首诊
                    </span>
                  )}
                </div>
                <p className="font-medium text-gray-900 truncate">
                  {appointment.hospital_name}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {appointment.department}
                  </span>
                  {appointment.appointment_time && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {appointment.appointment_time.slice(0, 5)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default AppointmentReminder;
