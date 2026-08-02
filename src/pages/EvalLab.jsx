import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import EvalSummary from '@/features/ai-report/components/EvalSummary.jsx';
import evalSnapshot from '@/features/ai-report/evalSnapshot.json';

const EvalLab = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-emerald-600">面试演示后台</p>
            <h1 className="text-xl font-semibold text-slate-900">AI 评测实验室</h1>
          </div>
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          这个页面只读取已提交的评测快照，不会在浏览器中批量调用模型。它用于展示 Prompt V0/V1
          的真实对比、自动指标、失败样本和发布门槛。
        </div>
        <EvalSummary snapshot={evalSnapshot} />
      </main>
    </div>
  );
};

export default EvalLab;
