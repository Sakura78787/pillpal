import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  Heart, 
  Shield, 
  Clock, 
  Bell, 
  Database, 
  ChevronRight,
  Sparkles,
  Pill,
  Activity,
  ChevronDown,
  User,
  CheckCircle2,
  TrendingUp,
  Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';

/**
 * 产品落地页 - 连贯上下滑动全屏特效版
 * 三屏设计：首屏吸引 + 功能展示 + 信任背书
 * 
 * 优化点：
 * 1. PC端保持复杂动效，移动端简化动效避免卡顿
 * 2. 使用CSS媒体查询检测设备类型
 * 3. 移动端使用静态渐变背景，减少Framer Motion动画负载
 * 4. 已登录用户自动跳转到首页
 */
const Landing = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  
  // 获取登录状态
  const { authStatus } = useAuthStore();
  
  useEffect(() => {
    if (authStatus === 'authenticated') {
      navigate('/dashboard', { replace: true });
    }
  }, [authStatus, navigate]);
  
  // 检测设备类型
  useEffect(() => {
    const checkDevice = () => {
      const isMobileDevice = window.matchMedia('(max-width: 768px)').matches || 
                             /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isMobileDevice);
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // 滚动进度监听
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // 固定使用一种背景
  const bgClass = 'from-emerald-400 via-teal-500 to-cyan-600';

  // 监听滚动位置，更新当前屏
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const newSection = Math.round(scrollY / windowHeight);
      setCurrentSection(Math.min(newSection, 2));
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 平滑滚动到指定屏
  const scrollToSection = (index) => {
    window.scrollTo({
      top: index * window.innerHeight,
      behavior: 'smooth'
    });
  };

  // PC端漂浮图标配置（移动端减少数量）
  const getFloatingIcons = () => {
    const allIcons = [
      { Icon: Heart, delay: 0, x: '10%', y: '20%', size: 48, color: 'text-white/20' },
      { Icon: Pill, delay: 0.5, x: '85%', y: '15%', size: 40, color: 'text-white/15' },
      { Icon: Clock, delay: 1, x: '75%', y: '70%', size: 56, color: 'text-white/20' },
      { Icon: Bell, delay: 1.5, x: '15%', y: '75%', size: 44, color: 'text-white/15' },
      { Icon: Shield, delay: 2, x: '90%', y: '45%', size: 36, color: 'text-white/10' },
      { Icon: Activity, delay: 2.5, x: '5%', y: '45%', size: 52, color: 'text-white/15' },
      { Icon: Database, delay: 3, x: '50%', y: '10%', size: 32, color: 'text-white/10' },
    ];
    
    // 移动端只显示4个图标，减少渲染负担
    return isMobile ? allIcons.slice(0, 4) : allIcons;
  };

  // 核心功能数据
  const features = [
    { 
      icon: Clock, 
      title: '准时提醒', 
      desc: '智能用药提醒，再忙也不会忘记',
      color: 'from-blue-400 to-cyan-400',
      stat: '98%',
      statLabel: '提醒送达率'
    },
    { 
      icon: Database, 
      title: '库存管理', 
      desc: '自动追踪药品余量，提前预警',
      color: 'from-amber-400 to-orange-400',
      stat: '7天',
      statLabel: '提前预警'
    },
    { 
      icon: Bell, 
      title: '复诊提醒', 
      desc: '复诊前3-7天主动提醒',
      color: 'from-green-400 to-emerald-400',
      stat: '3天',
      statLabel: '提前规划'
    },
    { 
      icon: Heart, 
      title: '健康记录', 
      desc: '血压血糖体重，一目了然',
      color: 'from-rose-400 to-pink-400',
      stat: '90天',
      statLabel: '历史数据'
    },
  ];

  // 用户价值点
  const values = [
    { icon: CheckCircle2, text: '3秒快速打卡，用药不再遗漏' },
    { icon: TrendingUp, text: '数据可视化，健康状况一目了然' },
    { icon: Shield, text: '数据加密存储，隐私安全有保障' },
  ];

  // 滚动指示器动画
  const y = useTransform(scrollYProgress, [0, 0.1], [0, 50]);
  const opacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);

  // 移动端：使用CSS渐变背景，性能更好
  const mobileBgClass = 'bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600';

  return (
    <div ref={containerRef} className="relative">
      {/* 固定背景层 */}
      <div className="fixed inset-0 z-0">
        {isMobile ? (
          // 移动端：静态CSS渐变背景，无动画
          <div className={`absolute inset-0 ${mobileBgClass}`} />
        ) : (
          // PC端：固定背景
          <div className={`absolute inset-0 bg-gradient-to-br ${bgClass}`} />
        )}
        
        {/* 通用遮罩和网格背景 */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }} />
        </div>
      </div>

      {/* 第一屏 - 核心入口页 */}
      <section className="relative z-10 h-screen w-full flex flex-col items-center justify-center px-6 overflow-hidden">
        {/* 漂浮图标 - 移动端减少数量和动画复杂度 */}
        {getFloatingIcons().map((item, index) => (
          <motion.div
            key={index}
            className={`absolute ${item.color} pointer-events-none`}
            style={{ left: item.x, top: item.y }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: isMobile ? 0.6 : 1, // 移动端降低透明度
              scale: 1,
              y: isMobile ? [0, -10, 0] : [0, -20, 0], // 移动端减少移动距离
              rotate: isMobile ? 0 : [0, 5, -5, 0], // 移动端不旋转
            }}
            transition={{
              opacity: { delay: item.delay, duration: 1 },
              scale: { delay: item.delay, duration: 1 },
              y: { 
                delay: item.delay + 1, 
                duration: isMobile ? 3 : 4, // 移动端动画更快
                repeat: Infinity, 
                ease: "easeInOut" 
              },
              rotate: isMobile ? undefined : { 
                delay: item.delay + 1, 
                duration: 6, 
                repeat: Infinity, 
                ease: "easeInOut" 
              },
            }}
          >
            <item.Icon size={isMobile ? item.size * 0.7 : item.size} strokeWidth={1.5} />
          </motion.div>
        ))}

        {/* 光晕效果 - 移动端简化 */}
        {!isMobile && (
          <>
            <motion.div
              className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none"
              animate={{
                scale: [1.2, 1, 1.2],
                opacity: [0.5, 0.3, 0.5],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}

        {/* Logo区域 */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="flex items-center gap-3 mb-6"
        >
          <motion.div 
            className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30"
            animate={isMobile ? {} : { 
              boxShadow: ['0 0 20px rgba(255,255,255,0.2)', '0 0 40px rgba(255,255,255,0.4)', '0 0 20px rgba(255,255,255,0.2)'],
            }}
            transition={isMobile ? {} : { duration: 2, repeat: Infinity }}
          >
            <Heart className="w-8 h-8 text-white" />
          </motion.div>
          <span className="text-2xl font-bold text-white">慢病用药小管家</span>
        </motion.div>

        {/* 主标题 */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="text-4xl md:text-6xl lg:text-7xl font-bold text-white text-center mb-6 leading-tight"
        >
          让每一次服药
          <br />
          <span className="relative inline-block">
            都不被遗忘
            <motion.span
              className="absolute -bottom-2 left-0 w-full h-1 bg-white/50 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ delay: 1.5, duration: 1 }}
            />
          </span>
        </motion.h1>

        {/* 副标题 */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="text-lg md:text-xl text-white/90 text-center max-w-2xl mb-10 leading-relaxed"
        >
          智能用药提醒 · 药品库存管理 · 复诊预约助手
          <br />
          <span className="text-white/80">您的贴心健康管理伙伴</span>
        </motion.p>

        {/* 核心入口按钮 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mb-12"
        >
          <Button
            onClick={() => navigate('/login')}
            className="group relative px-12 py-7 text-lg bg-white text-emerald-600 hover:bg-white/90 rounded-full shadow-2xl hover:shadow-white/25 transition-all duration-300 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2 font-semibold text-xl">
              立即开启健康之旅
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <ChevronRight className="w-6 h-6" />
              </motion.span>
            </span>
            
            {/* 按钮光效 - 移动端禁用 */}
            {!isMobile && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                initial={{ x: '-200%' }}
                animate={{ x: '200%' }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
              />
            )}
          </Button>
        </motion.div>

        {/* 底部提示标签 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="flex flex-wrap justify-center gap-3 mb-8"
        >
          {[
            { icon: Database, text: '登录后在线保存' },
            { icon: Shield, text: '隐私安全保护' },
          ].map((item, index) => (
            <motion.div
              key={index}
              className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8 + index * 0.1 }}
            >
              <item.icon className="w-4 h-4 text-white/80" />
              <span className="text-sm text-white/90">{item.text}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* 向下滚动提示 - 优化居中显示 */}
        <motion.div
          style={isMobile ? {} : { y, opacity }}
          className="absolute bottom-10 left-0 right-0 mx-auto w-full flex justify-center cursor-pointer"
          onClick={() => scrollToSection(1)}
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex flex-col items-center text-white/60 hover:text-white/90 transition-colors"
          >
            <span className="text-sm mb-2">探索更多</span>
            <div className="w-6 h-10 border-2 border-current rounded-full flex justify-center pt-2">
              <motion.div
                animate={{ y: [0, 12, 0], opacity: [1, 0, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 bg-current rounded-full"
              />
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* 第二屏 - 核心功能展示 */}
      <section className="relative z-10 min-h-screen w-full flex flex-col items-center justify-center px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            四大核心功能
          </h2>
          <p className="text-xl text-white/80">全方位守护您的用药健康</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl w-full">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={isMobile ? {} : { scale: 1.02, y: -5 }}
              className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 cursor-pointer group"
            >
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-8 h-8 text-white" />
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold text-white">{feature.stat}</span>
                <span className="text-white/70">{feature.statLabel}</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-white/80 text-lg">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* 向下滚动提示 */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          viewport={{ once: true }}
          className="mt-16 cursor-pointer"
          onClick={() => scrollToSection(2)}
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex flex-col items-center text-white/60 hover:text-white/90 transition-colors"
          >
            <ChevronDown className="w-8 h-8" />
          </motion.div>
        </motion.div>
      </section>

      {/* 第三屏 - 用户价值与最终CTA */}
      <section className="relative z-10 min-h-screen w-full flex flex-col items-center justify-center px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            为什么选择我们？
          </h2>
        </motion.div>

        {/* 价值点列表 */}
        <div className="max-w-3xl w-full space-y-6 mb-16">
          {values.map((value, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="flex items-center gap-6 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20"
            >
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <value.icon className="w-7 h-7 text-white" />
              </div>
              <span className="text-xl text-white font-medium">{value.text}</span>
            </motion.div>
          ))}
        </div>

        {/* 最终CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-2xl text-white font-semibold mb-8">
            立即开始，让健康管理变得简单
          </p>
          <Button
            onClick={() => navigate('/login')}
            className="group relative px-12 py-7 text-lg bg-white text-emerald-600 hover:bg-white/90 rounded-full shadow-2xl hover:shadow-white/25 transition-all duration-300 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2 font-semibold text-xl">
              <User className="w-6 h-6" />
              免费开始使用
              <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </span>
            {!isMobile && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                initial={{ x: '-200%' }}
                animate={{ x: '200%' }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
              />
            )}
          </Button>
        </motion.div>

        {/* 底部信息 */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          viewport={{ once: true }}
          className="absolute bottom-8 text-white/40 text-sm text-center"
        >
          {/* 医学免责声明 */}
          <p className="text-xs mb-2 opacity-70 max-w-md mx-auto px-4">
            本应用为健康管理工具，提供的内容仅供参考，不构成任何专业医疗建议。如有健康问题，请及时咨询专业医生。
          </p>
          <p>© 2026 慢病用药小管家 · MediCare Companion</p>
          <div className="flex justify-center gap-4 mt-2">
            <span>用户协议</span>
            <span>·</span>
            <span>隐私政策</span>
          </div>
        </motion.div>
      </section>

      {/* 右侧导航指示器 - 移动端隐藏 */}
      {!isMobile && (
        <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 hidden md:flex flex-col gap-3">
          {[0, 1, 2].map((index) => (
            <button
              key={index}
              onClick={() => scrollToSection(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                currentSection === index 
                  ? 'bg-white scale-125' 
                  : 'bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Landing;
