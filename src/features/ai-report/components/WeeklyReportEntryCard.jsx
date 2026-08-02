import React from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { isWeeklyReportEnabled } from '../config.js';

const WeeklyReportEntryCard = ({ enabled = isWeeklyReportEnabled() }) => {
  if (!enabled) return null;

  return (
    <a href="/weekly-report" className="block">
      <Card className="bg-white border border-emerald-100 hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">AI 用药管理周报</h3>
                <p className="text-xs text-gray-500">基于最近 7 天已记录数据生成</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </CardContent>
      </Card>
    </a>
  );
};

export default WeeklyReportEntryCard;
