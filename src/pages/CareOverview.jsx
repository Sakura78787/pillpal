import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CalendarDays, HeartPulse, Loader2, PackageSearch, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isWeeklyReportEnabled } from '@/features/ai-report/config.js';
import { loadWeeklySourceData } from '@/features/ai-report/loadWeeklySourceData.js';
import { buildCareOverview } from '@/features/care-overview/buildCareOverview.js';
import { requireSupabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';

const levelStyle = {
  action: 'border-rose-200 bg-rose-50',
  attention: 'border-amber-200 bg-amber-50',
  info: 'border-sky-200 bg-sky-50',
};

const DemoBoundary = () => (
  <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
    <p className="font-medium">Demo 使用边界</p>
    <p>当前使用本人账号数据模拟异地子女只读照护视角，尚未建立真实家庭账号绑定。</p>
  </div>
);

export function CareOverviewContent({ overview = null, loading = false, error = '', aiEnabled = false }) {
  if (loading) {
    return (
      <div className="space-y-4">
        <DemoBoundary />
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-gray-500">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-600" />
          <p>正在整理最近 7 天照护信息…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DemoBoundary />
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex gap-3 p-5 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div><p className="font-medium">读取照护数据失败</p><p className="mt-1">{error}</p></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!overview) return null;

  const { metrics } = overview;
  const appointmentText = metrics.nextAppointmentInDays == null
    ? '暂无近期预约'
    : metrics.nextAppointmentInDays === 0
      ? '今天'
      : `${metrics.nextAppointmentInDays} 天后`;

  return (
    <div className="space-y-4">
      <DemoBoundary />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">最近 7 天照护概览</CardTitle>
          <p className="text-xs text-gray-500">{overview.periodStart} 至 {overview.periodEnd}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-900">计划剂次</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-700">{metrics.due}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div><p className="text-lg font-semibold text-gray-900">{metrics.taken}</p><p className="text-gray-500">已记录服用</p></div>
              <div><p className="text-lg font-semibold text-gray-900">{metrics.skipped}</p><p className="text-gray-500">明确跳过</p></div>
              <div><p className="text-lg font-semibold text-gray-900">{metrics.unrecorded}</p><p className="text-gray-500">未记录</p></div>
            </div>
          </div>
          {metrics.due === 0 && (
            <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">近 7 天没有可汇总的用药计划剂次。</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 p-4">
              <PackageSearch className="h-5 w-5 text-amber-600" />
              <p className="mt-2 text-xs text-gray-500">低库存药品</p><p className="text-xl font-semibold">{metrics.lowStock} 种</p>
            </div>
            <div className="rounded-xl border border-gray-100 p-4">
              <HeartPulse className="h-5 w-5 text-rose-600" />
              <p className="mt-2 text-xs text-gray-500">健康记录</p><p className="text-xl font-semibold">{metrics.healthRecords} 条</p>
              {metrics.healthRecords === 0 && <p className="mt-1 text-xs text-gray-500">近 7 天暂无健康记录</p>}
            </div>
            <div className="rounded-xl border border-gray-100 p-4">
              <CalendarDays className="h-5 w-5 text-sky-600" />
              <p className="mt-2 text-xs text-gray-500">复诊倒计时</p><p className="text-xl font-semibold">{appointmentText}</p>
            </div>
          </div>
          <p className="text-xs leading-5 text-gray-500">健康数据仅展示记录数量，不判断健康状况；未记录仅表示记录待确认。</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">待确认事项</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {overview.actions.map((item) => (
            <div key={item.code} className={`rounded-xl border p-4 ${levelStyle[item.level] || levelStyle.info}`}>
              <p className="font-medium text-gray-900">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">{item.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-emerald-100">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-emerald-600" /><p className="font-medium">AI 家庭照护周报</p></div>
          <p className="text-sm leading-6 text-gray-600">在现有安全校验与健康数据确认流程下，把这些记录整理成家庭照护摘要。</p>
          {aiEnabled ? (
            <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700">
              <a href="/weekly-report?from=care">生成 AI 家庭照护周报</a>
            </Button>
          ) : (
            <Button className="w-full" disabled>AI 家庭照护周报暂未开启</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const CareOverview = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setPageTitle } = useUIStore();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { setPageTitle('家人照护'); }, [setPageTitle]);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const now = new Date();
        const sourceData = await loadWeeklySourceData({ client: requireSupabase(), userId: user.id, now });
        if (!cancelled) setOverview(buildCareOverview(sourceData, now));
      } catch {
        if (!cancelled) setError('请稍后重试；现有记录不会受到影响。');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />返回首页
      </Button>
      <CareOverviewContent overview={overview} loading={loading} error={error} aiEnabled={isWeeklyReportEnabled()} />
    </div>
  );
};

export default CareOverview;
