import { useState } from 'react';
import { X, Clock, Pill, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * 打卡弹窗组件
 * 用户确认服药时的弹窗，支持选择服用时间、记录感受
 * 
 * 修复：正确显示计划时间（使用传入的scheduled_time）
 */

const CheckInModal = ({ 
  isOpen, 
  onClose, 
  medication, 
  onConfirm,
  isLoading = false 
}) => {
  const [takenTime, setTakenTime] = useState('now');
  const [customTime, setCustomTime] = useState('');
  const [feelingScore, setFeelingScore] = useState(0);
  const [note, setNote] = useState('');

  if (!isOpen || !medication) return null;

  // 关键修复：获取正确的计划时间
  const getScheduledTime = () => {
    // 优先使用medication._time（从TimeGroup传入的具体时间）
    if (medication._time) {
      return medication._time;
    }
    // 然后是reminder_times数组的第一个
    if (medication.reminder_times && medication.reminder_times.length > 0) {
      return medication.reminder_times[0];
    }
    return '08:00';
  };

  const scheduledTime = getScheduledTime();

  // 获取当前时间（HH:MM格式）
  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  // 处理确认
  const handleConfirm = () => {
    let finalTakenAt = new Date().toISOString();
    
    // 如果是自定义时间
    if (takenTime === 'custom' && customTime) {
      const [hours, minutes] = customTime.split(':');
      const customDate = new Date();
      customDate.setHours(parseInt(hours), parseInt(minutes));
      finalTakenAt = customDate.toISOString();
    } else if (takenTime === 'scheduled') {
      // 使用计划时间 - 关键修复：使用正确的scheduledTime
      const [hours, minutes] = scheduledTime.split(':');
      const scheduledDate = new Date();
      scheduledDate.setHours(parseInt(hours), parseInt(minutes));
      finalTakenAt = scheduledDate.toISOString();
    }

    onConfirm?.({
      taken_at: finalTakenAt,
      feeling_score: feelingScore || null,
      note: note.trim() || null,
    });
  };

  // 处理关闭
  const handleClose = () => {
    setTakenTime('now');
    setCustomTime('');
    setFeelingScore(0);
    setNote('');
    onClose?.();
  };

  // 感受评分选项
  const feelingOptions = [
    { score: 1, label: '不适', emoji: '😣', color: 'text-red-500' },
    { score: 2, label: '一般', emoji: '😐', color: 'text-yellow-500' },
    { score: 3, label: '正常', emoji: '🙂', color: 'text-blue-500' },
    { score: 4, label: '良好', emoji: '😊', color: 'text-green-500' },
    { score: 5, label: '很好', emoji: '😄', color: 'text-green-600' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        {/* 头部 */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Pill className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">确认服药</h3>
              <p className="text-xs text-gray-500">记录本次用药情况</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="rounded-full"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-6">
          {/* 药物信息 */}
          <div className="bg-green-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-gray-900">{medication.name}</span>
              <span className="text-sm text-gray-500">
                {medication.dosage}{medication.unit}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              {/* 关键修复：显示正确的计划时间 */}
              计划时间：{scheduledTime.slice(0, 5)}
            </div>
          </div>

          {/* 服用时间选择 */}
          <div className="space-y-3">
            <Label>实际服用时间</Label>
            <RadioGroup
              value={takenTime}
              onValueChange={setTakenTime}
              className="space-y-2"
            >
              <div>
                <RadioGroupItem value="now" id="now" className="peer sr-only" />
                <Label
                  htmlFor="now"
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all",
                    takenTime === 'now'
                      ? "border-green-600 bg-green-50"
                      : "border-gray-200 hover:border-green-200"
                  )}
                >
                  <span>刚刚服用</span>
                  <span className="text-sm text-gray-500">{getCurrentTime()}</span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="scheduled" id="scheduled" className="peer sr-only" />
                <Label
                  htmlFor="scheduled"
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all",
                    takenTime === 'scheduled'
                      ? "border-green-600 bg-green-50"
                      : "border-gray-200 hover:border-green-200"
                  )}
                >
                  <span>按计划时间服用</span>
                  <span className="text-sm text-gray-500">
                    {/* 关键修复：显示正确的计划时间 */}
                    {scheduledTime.slice(0, 5)}
                  </span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="custom" id="custom" className="peer sr-only" />
                <Label
                  htmlFor="custom"
                  className={cn(
                    "flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all gap-3",
                    takenTime === 'custom'
                      ? "border-green-600 bg-green-50"
                      : "border-gray-200 hover:border-green-200"
                  )}
                >
                  <span className="flex-shrink-0">其他时间</span>
                  {takenTime === 'custom' && (
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="flex-1 px-2 py-1 border rounded text-sm bg-white"
                      autoFocus
                    />
                  )}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 服药感受 */}
          <div className="space-y-3">
            <Label>服药感受（可选）</Label>
            <div className="flex justify-center gap-2">
              {feelingOptions.map((option) => (
                <button
                  key={option.score}
                  type="button"
                  onClick={() => setFeelingScore(option.score)}
                  className={cn(
                    "flex flex-col items-center p-2 rounded-lg transition-all min-w-[52px]",
                    feelingScore === option.score
                      ? "bg-green-100 ring-2 ring-green-500"
                      : "hover:bg-gray-100"
                  )}
                >
                  <span className="text-2xl mb-1">{option.emoji}</span>
                  <span className={cn(
                    "text-xs font-medium",
                    feelingScore === option.score ? option.color : "text-gray-500"
                  )}>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 备注 */}
          <div className="space-y-2">
            <Label htmlFor="note">备注（可选）</Label>
            <Textarea
              id="note"
              placeholder="记录任何不适症状或其他信息..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="sticky bottom-0 bg-white px-6 py-4 border-t flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={handleClose}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button
            className="flex-1 h-12 bg-green-600 hover:bg-green-700"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                保存中...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                确认打卡
              </span>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default CheckInModal;
