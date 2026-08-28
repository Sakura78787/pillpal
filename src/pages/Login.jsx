import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Mail, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendMagicLink } from '@/api/auth';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';

const Login = () => {
  const navigate = useNavigate();
  const { authStatus, startGuestSession } = useAuthStore();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sentTo, setSentTo] = useState('');

  useEffect(() => {
    if (authStatus === 'authenticated') {
      navigate('/dashboard', { replace: true });
    }
  }, [authStatus, navigate]);

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isValidEmail(email)) {
      toast.error('请输入正确的邮箱地址');
      return;
    }

    setIsLoading(true);
    const result = await sendMagicLink(email.trim());

    if (result.success) {
      setSentTo(email.trim());
      toast.success('登录链接已发送，请查收邮箱');
    } else {
      toast.error(result.error || '发送失败，请稍后重试');
    }

    setIsLoading(false);
  };

  const handleGuestExperience = () => {
    const result = startGuestSession();
    if (!result.success) {
      toast.error(result.error || '暂时无法启动访客体验，请稍后重试');
      return;
    }
    if (result.persistence === 'memory') {
      toast.info('当前浏览器无法保存本次会话，刷新后体验数据会重置');
    }
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
            <Shield className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            慢病用药小管家
          </CardTitle>
          <CardDescription className="text-gray-600">
            使用邮箱 Magic Link 登录，数据将在线保存
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {!isSupabaseConfigured && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">
                当前缺少 Supabase 环境变量，请配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY 后再登录。
              </p>
            </div>
          )}

          {sentTo ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
              <p className="font-medium mb-1">登录链接已发送</p>
              <p className="text-green-700">
                请打开 {sentTo} 收到的邮件，点击链接后会回到应用。
              </p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱地址</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="请输入邮箱地址"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="pl-10"
                  autoComplete="email"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={!isValidEmail(email) || isLoading || !isSupabaseConfigured}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  发送中...
                </>
              ) : (
                '发送登录链接'
              )}
            </Button>
          </form>

          <div className="space-y-2 border-t pt-4 text-center">
            <Button type="button" variant="outline" className="w-full" onClick={handleGuestExperience}>
              访客体验（无需登录）
            </Button>
            <p className="text-xs leading-relaxed text-gray-500">
              使用合成示例数据；你的操作仅在当前标签页会话内保留，不上传云端。请勿输入真实健康或处方信息。
            </p>
          </div>

          <p className="text-xs text-gray-500 text-center leading-relaxed">
            登录后核心数据在线保存；访客数据不会迁移到账号。
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
