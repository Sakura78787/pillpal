import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireSupabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { isWeeklyReportEnabled } from '@/features/ai-report/config.js';
import { loadWeeklySourceData } from '@/features/ai-report/loadWeeklySourceData.js';
import { buildWeeklyReportContext } from '@/features/ai-report/buildWeeklyFacts.js';
import { getWeeklyReportJob, startWeeklyReportJob, waitForWeeklyReportJob } from '@/features/ai-report/api.js';
import { ensureHealthDataConsent } from '@/features/ai-report/healthConsent.js';
import {
  clearWeeklyReportJob,
  getWeeklyReportJobId,
  saveWeeklyReportJobId,
} from '@/features/ai-report/jobStorage.js';
import WeeklyReportResult from '@/features/ai-report/components/WeeklyReportResult.jsx';

const STATUS_TEXT = {
  queued: '任务已进入队列，正在准备分析…',
  running: 'AI 正在分析，通常需要 30～90 秒，可以暂时离开此页面。',
};

export const weeklyReportReturnTarget = (search = '') => (
  new URLSearchParams(search).get('from') === 'care' ? '/care' : '/dashboard'
);

export const weeklyReportView = (search = '') => {
  const returnTarget = weeklyReportReturnTarget(search);
  const fromCare = returnTarget === '/care';
  return {
    fromCare,
    returnTarget,
    returnLabel: fromCare ? '返回照护概览' : '返回今日',
    title: fromCare ? 'AI 家庭照护周报' : 'AI 用药管理周报',
    description: fromCare
      ? '基于最近 7 天已记录数据，帮助异地子女了解计划执行线索、健康记录和下周照护行动。未记录不等于确认漏服。'
      : '基于最近 7 天已记录数据，整理用药计划执行、健康记录与后续行动。未记录不等于确认漏服。',
  };
};

export const WeeklyReportIntro = ({ view }) => (
  <div className="space-y-3">
    {view.fromCare && (
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
        <p className="font-medium">Demo 使用边界</p>
        <p>当前使用本人账号数据模拟异地子女只读照护视角，尚未建立真实家庭账号绑定。</p>
      </div>
    )}
    <div>
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <Sparkles className="w-5 h-5 text-emerald-600" />{view.title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-gray-600">{view.description}</p>
    </div>
  </div>
);

export const WeeklyReportUnavailable = ({ view, onBack }) => (
  <div className="min-h-screen bg-gray-50 p-4">
    <Button variant="ghost" onClick={onBack} className="mb-4">
      <ArrowLeft className="w-4 h-4 mr-2" />{view.returnLabel}
    </Button>
    <Card>
      <CardContent className="space-y-4 p-6">
        <WeeklyReportIntro view={view} />
        <p className="text-sm text-gray-600">{view.title}暂未开启。</p>
      </CardContent>
    </Card>
  </div>
);

const WeeklyReport = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const view = weeklyReportView(location.search);
  const { user } = useAuthStore();
  const { setPageTitle } = useUIStore();
  const enabled = isWeeklyReportEnabled();
  const [facts, setFacts] = useState(null);
  const [medicationNamesByRef, setMedicationNamesByRef] = useState({});
  const [report, setReport] = useState(null);
  const [isLoadingFacts, setIsLoadingFacts] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobStatus, setJobStatus] = useState('');
  const [activeJobId, setActiveJobId] = useState('');
  const [error, setError] = useState('');
  const pollingControllerRef = useRef(null);

  useEffect(() => { setPageTitle(view.title); }, [setPageTitle, view.title]);

  useEffect(() => {
    if (!enabled || !user?.id) return;
    let cancelled = false;
    (async () => {
      setIsLoadingFacts(true);
      setError('');
      try {
        const sourceData = await loadWeeklySourceData({ client: requireSupabase(), userId: user.id, now: new Date() });
        const context = buildWeeklyReportContext(sourceData, new Date());
        if (!cancelled) {
          setFacts(context.facts);
          setMedicationNamesByRef(context.medicationNamesByRef);
        }
      } catch {
        if (!cancelled) setError('读取周报数据失败，请稍后重试');
      } finally {
        if (!cancelled) setIsLoadingFacts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, user?.id]);

  const monitorJob = useCallback(async (jobId, pollIntervalMs = 2000) => {
    pollingControllerRef.current?.abort();
    const controller = new AbortController();
    pollingControllerRef.current = controller;
    setIsGenerating(true);
    setError('');

    const result = await waitForWeeklyReportJob({
      jobId,
      pollIntervalMs,
      signal: controller.signal,
      onStatus: setJobStatus,
      getJob: (id) => getWeeklyReportJob({ supabase: requireSupabase(), jobId: id }),
    });

    if (controller.signal.aborted) return;
    if (result.success) {
      setReport(result.job.report);
      setJobStatus('succeeded');
    } else if (!result.cancelled) {
      setError(result.error);
      if (!result.pending) {
        clearWeeklyReportJob(user?.id);
        setActiveJobId('');
        setJobStatus('failed');
      }
    }
    setIsGenerating(false);
  }, [user?.id]);

  useEffect(() => {
    if (!facts || !user?.id || activeJobId || report) return;
    const storedJobId = getWeeklyReportJobId(user.id);
    if (!storedJobId) return;
    setActiveJobId(storedJobId);
    monitorJob(storedJobId);
  }, [activeJobId, facts, monitorJob, report, user?.id]);

  useEffect(() => () => pollingControllerRef.current?.abort(), []);

  const totalHealthRecords = useMemo(
    () => facts ? Object.values(facts.healthRecordCounts).reduce((sum, count) => sum + count, 0) : 0,
    [facts]
  );

  const handleGenerate = async () => {
    if (activeJobId && !report) {
      await monitorJob(activeJobId);
      return;
    }
    if (!facts || !ensureHealthDataConsent()) {
      if (facts) setError('你尚未授权发送健康指标数据，本次未调用 AI 模型。');
      return;
    }

    setIsGenerating(true);
    setJobStatus('queued');
    setError('');
    setReport(null);
    const result = await startWeeklyReportJob({ supabase: requireSupabase(), facts });
    if (!result.success) {
      setError(result.error);
      setIsGenerating(false);
      setJobStatus('failed');
      return;
    }

    setActiveJobId(result.job.id);
    saveWeeklyReportJobId(user.id, result.job.id);
    await monitorJob(result.job.id, result.pollAfterMs);
  };

  if (!enabled) {
    return <WeeklyReportUnavailable view={view} onBack={() => navigate(view.returnTarget)} />;
  }

  const buttonText = isGenerating
    ? '正在生成周报…'
    : activeJobId && !report
      ? '继续查询'
      : report
        ? '重新生成周报'
        : '生成周报';

  return <div className="min-h-screen bg-gray-50 p-4 pb-24">
    <Button variant="ghost" onClick={() => navigate(view.returnTarget)} className="mb-4">
      <ArrowLeft className="w-4 h-4 mr-2" />{view.returnLabel}
    </Button>
    <Card className="mb-4 border-emerald-100">
      <CardHeader>
        <WeeklyReportIntro view={view} />
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoadingFacts ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />正在读取周报数据…
          </div>
        ) : facts ? (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ['已到期计划', facts.dueDoseCount],
              ['已记录服用', facts.takenDoseCount],
              ['未记录', facts.unrecordedDoseCount],
              ['健康记录', totalHealthRecords],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-gray-50 p-3">
                <p className="text-gray-500">{label}</p>
                <p className="mt-1 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
        ) : null}
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          disabled={!facts || isGenerating || isLoadingFacts}
          onClick={handleGenerate}
        >
          {isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{buttonText}
        </Button>
        {isGenerating && STATUS_TEXT[jobStatus] && (
          <p className="text-center text-sm text-emerald-700">{STATUS_TEXT[jobStatus]}</p>
        )}
        <p className="text-xs leading-5 text-gray-500">
          生成时会将最近 7 天的血压、血糖和体重数值发送给千问；不会发送姓名、邮箱、药品名称、剂量、医院医生或备注。结果仅用于信息整理，不构成医疗建议。
        </p>
      </CardContent>
    </Card>
    {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <WeeklyReportResult report={report} facts={facts} medicationNamesByRef={medicationNamesByRef} />
  </div>;
};

export default WeeklyReport;
