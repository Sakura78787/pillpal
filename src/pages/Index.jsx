import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';

/**
 * 入口页面
 * 根据登录状态自动跳转到相应页面
 */
const Index = () => {
  const navigate = useNavigate();
  const { authStatus } = useAuthStore();

  useEffect(() => {
    // 等待认证状态确定
    if (authStatus === 'loading') return;

    // 未登录跳转到落地页
    if (authStatus === 'unauthenticated') {
      navigate('/');
      return;
    }

    if (authStatus === 'authenticated') {
      navigate('/dashboard', { replace: true });
    }
  }, [authStatus, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 flex items-center justify-center">
      <div className="text-center">
        <motion.div 
          className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30"
          animate={{ 
            boxShadow: ['0 0 20px rgba(255,255,255,0.2)', '0 0 40px rgba(255,255,255,0.4)', '0 0 20px rgba(255,255,255,0.2)'],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </motion.div>
        <h1 className="text-xl font-semibold text-white mb-2">慢病用药小管家</h1>
        <p className="text-sm text-white/70">正在加载...</p>
      </div>
    </div>
  );
};

export default Index;
