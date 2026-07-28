import { Download, Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

const DataExport = () => {
  const handleDisabledAction = () => {
    toast.info('导入导出功能本阶段未启用', {
      description: '当前迁移版本先保障在线登录和核心数据读写，备份恢复会在后续单独接入云端实现。',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5 text-green-600" />
          数据导入导出
        </CardTitle>
        <CardDescription>
          当前迁移阶段暂不启用本地文件备份与恢复
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-700">
            本阶段核心数据直接保存到 Supabase。为避免导入本地旧数据造成冲突，导入导出功能暂时关闭。
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={handleDisabledAction}>
            <Download className="w-4 h-4 mr-2" />
            导出数据
          </Button>
          <Button variant="outline" onClick={handleDisabledAction}>
            <Upload className="w-4 h-4 mr-2" />
            导入数据
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataExport;
