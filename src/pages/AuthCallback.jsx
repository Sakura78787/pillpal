import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { initializeAuth } = useAuthStore();
  const [message, setMessage] = useState('正在完成登录...');

  useEffect(() => {
    const finishLogin = async () => {
      await initializeAuth();
      const state = useAuthStore.getState();

      if (state.authStatus === 'authenticated') {
        navigate('/dashboard', { replace: true });
        return;
      }

      setMessage(state.error || '登录链接已失效，请重新发送');
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    };

    finishLogin();
  }, [initializeAuth, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="flex flex-col items-center text-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-3" />
        <p className="text-gray-700">{message}</p>
      </div>
    </div>
  );
};

export default AuthCallback;
