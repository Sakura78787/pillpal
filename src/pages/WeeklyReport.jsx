import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireSupabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { isWeeklyReportEnabled } from '@/features/ai-report/config.js';
import { loadWeeklySourceData } from '@/features/ai-report/loadWeeklySourceData.js';
import { buildWeeklyReportContext } from '@/features/ai-report/buildWeeklyFacts.js';
import { generateWeeklyReport } from '@/features/ai-report/api.js';
import { ensureHealthDataConsent } from '@/features/ai-report/healthConsent.js';
import WeeklyReportResult from '@/features/ai-report/components/WeeklyReportResult.jsx';

const WeeklyReport = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setPageTitle } = useUIStore();
  const enabled = isWeeklyReportEnabled();
  const [facts, setFacts] = useState(null);
  const [medicationNamesByRef, setMedicationNamesByRef] = useState({});
  const [report, setReport] = useState(null);
  const [isLoadingFacts, setIsLoadingFacts] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setPageTitle('AI 用药管理周报'); }, [setPageTitle]);
  useEffect(() => {
    if (!enabled || !user?.id) return;
    let cancelled = false;
    (async () => {
      setIsLoadingFacts(true); setError('');
      try {
        const sourceData = await loadWeeklySourceData({ client: requireSupabase(), userId: user.id, now: new Date() });
        const context = buildWeeklyReportContext(sourceData, new Date());
        if (!cancelled) { setFacts(context.facts); setMedicationNamesByRef(context.medicationNamesByRef); }
      } catch { if (!cancelled) setError('读取周报数据失败，请稍后重试'); }
      finally { if (!cancelled) setIsLoadingFacts(false); }
    })();
    return () => { cancelled = true; };
  }, [enabled, user?.id]);

  const totalHealthRecords = useMemo(() => facts ? Object.values(facts.healthRecordCounts).reduce((sum, count) => sum + count, 0) : 0, [facts]);
  const handleGenerate = async () => {
    if (!facts || !ensureHealthDataConsent()) {
      if (facts) setError('你尚未授权发送健康指标数据，本次未调用 AI 模型。');
      return;
    }
    setIsGenerating(true); setError(''); setReport(null);
    const result = await generateWeeklyReport({ supabase: requireSupabase(), facts });
    if (result.success) setReport(result.report); else setError(result.error);
    setIsGenerating(false);
  };

  if (!enabled) return <div className="min-h-screen bg-gray-50 p-4"><Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4"><ArrowLeft className="w-4 h-4 mr-2" />返回</Button><Card><CardContent className="p-6 text-sm text-gray-600">AI 用药管理周报暂未开启。</CardContent></Card></div>;

  return <div className="min-h-screen bg-gray-50 p-4 pb-24">
    <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4"><ArrowLeft className="w-4 h-4 mr-2" />返回今日</Button>
    <Card className="mb-4 border-emerald-100"><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Sparkles className="w-5 h-5 text-emerald-600" />AI 家庭照护周报</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm leading-6 text-gray-600">基于最近 7 天已记录数据，帮助异地子女了解计划执行线索、健康记录和下周照护行动。未记录不等于确认漏服。</p>
      {isLoadingFacts ? <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" />正在读取周报数据...</div> : facts ? <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[['已到期计划', facts.dueDoseCount], ['已记录服用', facts.takenDoseCount], ['未记录', facts.unrecordedDoseCount], ['健康记录', totalHealthRecords]].map(([label, value]) => <div key={label} className="rounded-lg bg-gray-50 p-3"><p className="text-gray-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}
      </div> : null}
      <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={!facts || isGenerating || isLoadingFacts} onClick={handleGenerate}>{isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}生成周报</Button>
      <p className="text-xs leading-5 text-gray-500">生成时会将最近 7 天的血压、血糖和体重数值发送给千问；不会发送姓名、邮箱、药品名称、剂量、医院医生或备注。结果仅用于信息整理，不构成医疗建议。</p>
    </CardContent></Card>
    {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <WeeklyReportResult report={report} facts={facts} medicationNamesByRef={medicationNamesByRef} />
  </div>;
};

export default WeeklyReport;
