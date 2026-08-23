import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, BellRing, CalendarDays, HeartPulse, Loader2, PackageSearch, Sparkles } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isWeeklyReportEnabled } from '@/features/ai-report/config.js';
import { getCareOverview, getCareSubjects } from '@/api/care';
import { sendMedicationReminder } from '@/api/notifications';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

const levelStyle = { action: 'border-rose-200 bg-rose-50', attention: 'border-amber-200 bg-amber-50', info: 'border-sky-200 bg-sky-50' };
export const CareWeeklyReportLink = ({ subjectUserId = '' } = {}) => <Link to={`/weekly-report?from=care&subject=${encodeURIComponent(subjectUserId)}`} className={cn(buttonVariants(), 'w-full bg-emerald-600 hover:bg-emerald-700')}>生成 AI 家庭照护周报</Link>;

export function CareOverviewContent({ overview = null, loading = false, error = '', aiEnabled = false, subjectUserId = '', onRemind, reminding = false }) {
  if (loading) return <div className="flex min-h-[40vh] flex-col items-center justify-center text-gray-500"><Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-600" /><p>正在整理最近 7 天照护信息…</p></div>;
  if (error) return <Card className="border-red-200 bg-red-50"><CardContent className="flex gap-3 p-5 text-sm text-red-700"><AlertCircle className="h-5 w-5 shrink-0" /><div><p className="font-medium">读取照护数据失败</p><p className="mt-1">{error}</p></div></CardContent></Card>;
  if (!overview) return null;
  const { metrics } = overview;
  const appointmentText = metrics.nextAppointmentInDays == null ? '暂无近期预约' : metrics.nextAppointmentInDays === 0 ? '今天' : `${metrics.nextAppointmentInDays} 天后`;
  return <div className="space-y-4">
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900"><p className="font-medium">只读照护</p><p>你正在查看已授权家人的照护摘要；不能编辑、打卡或修改健康数据。</p></div>
    <Card><CardHeader className="pb-3"><CardTitle className="text-lg">最近 7 天照护概览</CardTitle><p className="text-xs text-gray-500">{overview.periodStart} 至 {overview.periodEnd}</p></CardHeader><CardContent className="space-y-4">
      <div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm font-medium text-emerald-900">计划剂次</p><p className="mt-1 text-3xl font-semibold text-emerald-700">{metrics.due}</p><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div><p className="text-lg font-semibold text-gray-900">{metrics.taken}</p><p className="text-gray-500">已记录服用</p></div><div><p className="text-lg font-semibold text-gray-900">{metrics.skipped}</p><p className="text-gray-500">明确跳过</p></div><div><p className="text-lg font-semibold text-gray-900">{metrics.unrecorded}</p><p className="text-gray-500">待确认</p></div></div></div>
      {metrics.due === 0 && <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">近 7 天没有可汇总的计划剂次。</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-xl border border-gray-100 p-4"><PackageSearch className="h-5 w-5 text-amber-600" /><p className="mt-2 text-xs text-gray-500">低库存药品</p><p className="text-xl font-semibold">{metrics.lowStock} 种</p></div><div className="rounded-xl border border-gray-100 p-4"><HeartPulse className="h-5 w-5 text-rose-600" /><p className="mt-2 text-xs text-gray-500">健康记录</p><p className="text-xl font-semibold">{metrics.healthRecords} 条</p></div><div className="rounded-xl border border-gray-100 p-4"><CalendarDays className="h-5 w-5 text-sky-600" /><p className="mt-2 text-xs text-gray-500">复诊倒计时</p><p className="text-xl font-semibold">{appointmentText}</p></div></div>
      <p className="text-xs leading-5 text-gray-500">健康数据仅展示记录数量，不判断健康状况；待确认仅表示记录尚未完善。</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-lg">待确认事项</CardTitle></CardHeader><CardContent className="space-y-3">{overview.actions.map((item) => <div key={item.code} className={`rounded-xl border p-4 ${levelStyle[item.level] || levelStyle.info}`}><p className="font-medium text-gray-900">{item.title}</p><p className="mt-1 text-sm leading-6 text-gray-600">{item.description}</p></div>)}</CardContent></Card>
    <Card className="border-amber-100"><CardContent className="space-y-3 p-5"><div className="flex items-center gap-2"><BellRing className="h-5 w-5 text-amber-600" /><p className="font-medium">提醒按时服药</p></div><p className="text-sm text-gray-600">将向家人发送固定站内提醒，不推断实际用药情况。</p><Button className="w-full bg-amber-600 hover:bg-amber-700" disabled={reminding} onClick={onRemind}>{reminding ? '发送中…' : '提醒按时服药'}</Button></CardContent></Card>
    <Card className="border-emerald-100"><CardContent className="space-y-3 p-5"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-emerald-600" /><p className="font-medium">AI 家庭照护周报</p></div><p className="text-sm leading-6 text-gray-600">在既有安全校验与健康数据确认流程下，整理近期照护信息。</p>{aiEnabled ? <CareWeeklyReportLink subjectUserId={subjectUserId} /> : <Button className="w-full" disabled>AI 家庭照护周报暂未开启</Button>}</CardContent></Card>
  </div>;
}

const CareOverview = () => {
  const navigate = useNavigate(); const [searchParams, setSearchParams] = useSearchParams(); const { setPageTitle } = useUIStore();
  const [subjects, setSubjects] = useState([]); const [overview, setOverview] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [reminding, setReminding] = useState(false);
  const subjectUserId = searchParams.get('subject') || subjects[0]?.owner_user_id || '';
  useEffect(() => { setPageTitle('家人照护'); }, [setPageTitle]);
  useEffect(() => { getCareSubjects().then(({ subjects: next }) => setSubjects(next)).catch(() => setError('读取授权关系失败，请稍后重试')); }, []);
  useEffect(() => { if (!subjectUserId) { setLoading(false); return; } setLoading(true); setError(''); getCareOverview(subjectUserId).then(({ overview: next }) => setOverview(next)).catch(() => setError('请稍后重试；现有记录不会受到影响。')).finally(() => setLoading(false)); }, [subjectUserId]);
  const remind = async () => { setReminding(true); try { await sendMedicationReminder(subjectUserId); toast.success('已发送服药提醒'); } catch (err) { toast.error(err.message === 'NOTIFICATION_REMINDER_RATE_LIMITED' ? '近期已有家人提醒，请稍后再试' : '发送提醒失败，请稍后重试'); } finally { setReminding(false); } };
  return <div className="min-h-screen bg-gray-50 p-4 pb-24"><Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />返回首页</Button>{subjects.length > 1 && <div className="mb-4 flex flex-wrap gap-2">{subjects.map((subject) => <Button key={subject.id} variant={subject.owner_user_id === subjectUserId ? 'default' : 'outline'} onClick={() => setSearchParams({ subject: subject.owner_user_id })}>{subject.owner_label}</Button>)}</div>}{!loading && !error && !subjectUserId ? <Card><CardContent className="space-y-3 p-6"><p className="font-medium">暂无可查看的家人</p><p className="text-sm text-gray-600">请让家人先在“授权管理”中填写你的登录邮箱；你登录后会自动获得只读照护权限。</p><Link className={buttonVariants({ variant: 'outline' })} to="/care/permissions">前往授权管理</Link></CardContent></Card> : <CareOverviewContent overview={overview} loading={loading} error={error} aiEnabled={isWeeklyReportEnabled()} subjectUserId={subjectUserId} onRemind={remind} reminding={reminding} />}</div>;
};
export default CareOverview;
