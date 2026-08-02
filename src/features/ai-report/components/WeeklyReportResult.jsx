import React from 'react';
import { AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const WeeklyReportResult = ({ report }) => {
  if (!report) return null;

  return (
    <div className="space-y-4">
      <Card className="border-emerald-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-emerald-600" />
            本周概览
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-gray-700">{report.summary}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">重点关注</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.highlights.map((highlight, index) => (
            <div key={`${highlight.type}-${index}`} className="flex gap-3 rounded-lg bg-gray-50 p-3">
              <CheckCircle2 className="mt-0.5 w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-800">{highlight.text}</p>
                <p className="mt-1 text-xs text-gray-400">证据：{highlight.evidence_ids.join(', ')}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {report.data_gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">数据缺口</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.data_gaps.map((gap, index) => (
              <div key={index} className="flex gap-2 text-sm text-amber-700">
                <AlertTriangle className="mt-0.5 w-4 h-4 flex-shrink-0" />
                <span>{gap}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
        {report.disclaimer} AI 生成内容可能出错，请以原始记录为准。
      </div>
    </div>
  );
};

export default WeeklyReportResult;
