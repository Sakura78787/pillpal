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
import { buildWeeklyFacts } from '@/features/ai-report/buildWeeklyFacts.js';
import { generateWeeklyReport } from '@/features/ai-report/api.js';
import WeeklyReportResult from '@/features/ai-report/components/WeeklyReportResult.jsx';

const WeeklyReport = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setPageTitle } = useUIStore();
  const enabled = isWeeklyReportEnabled();
  const [facts, setFacts] = useState(null);
  const [report, setReport] = useState(null);
  const [isLoadingFacts, setIsLoadingFacts] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPageTitle('AI 用药管理周报');
  }, [setPageTitle]);

  useEffect(() => {
    if (!enabled || !user?.id) return;

    let cancelled = false;
    const loadFacts = async () => {
      setIsLoadingFacts(true);
      setError('');
      try {
        const client = requireSupabase();
        const sourceData = await loadWeeklySourceData({ client, userId: user.id, now: new Date() });
        const nextFacts = buildWeeklyFacts(sourceData, new Date());
        if (!cancelled) setFacts(nextFacts);
      } catch {
        if (!cancelled) setError('读取周报数据失败，请稍后重试');
      } finally {
        if (!cancelled) setIsLoadingFacts(false);
      }
    };

    loadFacts();
    return () => {
      cancelled = true;
    };
  }, [enabled, user?.id]);

  const totalHealthRecords = useMemo(() => {
    if (!facts) return 0;
    return Object.values(facts.healthRecordCounts).reduce((sum, count) => sum + count, 0);
  }, [facts]);

  const handleGenerate = async () => {
    if (!facts) return;
    setIsGenerating(true);
    setError('');
    setReport(null);
    const client = requireSupabase();
    const result = await generateWeeklyReport({ supabase: client, facts });
    if (result.success) {
      setReport(result.report);
    } else {
      setError(result.error);
    }
    setIsGenerating(false);
  };

  if (!enabled) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
        <Card>
          <CardContent className="p-6 text-sm text-gray-600">
            AI 用药管理周报暂未开启。
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        返回今日
      </Button>

      <Card className="mb-4 border-emerald-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            AI 用药管理周报
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-gray-600">
            基于最近 7 天已记录数据生成。当前只统计已记录服用/跳过次数，不计算依从率。
          </p>

          {isLoadingFacts ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              正在读取周报数据...
            </div>
          ) : facts ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-gray-500">已记录服用</p>
                <p className="mt-1 text-xl font-semibold text-gray-900">{facts.recordedTakenCount}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-gray-500">已记录跳过</p>
                <p className="mt-1 text-xl font-semibold text-gray-900">{facts.recordedSkippedCount}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-gray-500">低库存药品种数</p>
                <p className="mt-1 text-xl font-semibold text-gray-900">{facts.lowStockMedicationCount}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-gray-500">健康记录条数</p>
                <p className="mt-1 text-xl font-semibold text-gray-900">{totalHealthRecords}</p>
              </div>
            </div>
          ) : null}

          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={!facts || isGenerating || isLoadingFacts}
            onClick={handleGenerate}
          >
            {isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            生成周报
          </Button>

          <p className="text-xs leading-5 text-gray-500">
            本功能不会把药品名称、剂量、医院医生、原始健康数值或用户身份发送给模型。
          </p>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <WeeklyReportResult report={report} />
    </div>
  );
};

export default WeeklyReport;
