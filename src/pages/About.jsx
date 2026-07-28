
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  Heart, 
  Shield, 
  Smartphone, 
  Users, 
  Clock, 
  Bell,
  Database,
  Lock,
  Sparkles,
  Mail,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUIStore } from '@/store/uiStore';

/**
 * 关于我们页面
 * 介绍产品功能、团队理念、联系方式等信息
 */
const About = () => {
  const navigate = useNavigate();
  const { setPageTitle } = useUIStore();

  useEffect(() => {
    setPageTitle('关于我们');
  }, [setPageTitle]);

  // 核心功能列表
  const features = [
    {
      icon: Clock,
      title: '智能用药提醒',
      desc: '根据您的用药计划，在应用内展示待服药事项，支持多时段、多频次设置',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50'
    },
    {
      icon: Database,
      title: '药品库存管理',
      desc: '追踪药品余量，库存不足时给出预警，支持手动更新库存',
      color: 'text-amber-500',
      bgColor: 'bg-amber-50'
    },
    {
      icon: Bell,
      title: '复诊预约提醒',
      desc: '记录复诊时间，提前3-7天在应用内提示，不再错过重要复诊',
      color: 'text-green-500',
      bgColor: 'bg-green-50'
    },
    {
      icon: Shield,
      title: '健康数据记录',
      desc: '记录血压、血糖、体重等关键指标，生成趋势图表，医患沟通更便捷',
      color: 'text-rose-500',
      bgColor: 'bg-rose-50'
    }
    // 移除"家人远程关怀"功能，因为尚未实现
  ];

  // 产品亮点
  const highlights = [
    { title: '3秒', desc: '快速完成打卡' },
    { title: '7天', desc: '库存提前预警' },
    { title: '90天', desc: '历史记录保存' },
    { title: '在线', desc: '数据登录后保存' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* 顶部导航 */}
      <div className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/profile')}
          className="mr-2"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1">关于我们</h1>
      </div>

      {/* 产品头部介绍 */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white px-6 py-10">
        <div className="flex items-center justify-center mb-6">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <Heart className="w-10 h-10" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-2">慢病用药小管家</h2>
        <p className="text-center text-green-100 mb-4">MediCare Companion</p>
        <p className="text-center text-sm text-green-50 leading-relaxed">
          让每一次服药都不被遗忘<br/>
          让每一次复诊都准时抵达
        </p>
        <div className="flex justify-center mt-4">
          <Badge className="bg-white/20 text-white border-0">v1.2.0</Badge>
        </div>
      </div>

      {/* 核心数据 */}
      <div className="px-4 -mt-4">
        <Card className="shadow-lg">
          <CardContent className="p-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              {highlights.map((item, index) => (
                <div key={index}>
                  <div className="text-xl font-bold text-green-600">{item.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 产品理念 */}
      <div className="px-4 mt-6">
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-2">我们的理念</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  中国慢性病患者已超过3亿人，用药依从性低是长期困扰患者和医生的难题。
                  我们致力于用技术的温度，打造一款真正懂患者、帮患者的用药管理工具，
                  让每一位慢病患者都能轻松管理自己的健康。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 核心功能 */}
      <div className="px-4 mt-6">
        <h3 className="text-base font-medium text-gray-900 mb-3">核心功能</h3>
        <div className="space-y-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 ${feature.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${feature.color}`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{feature.title}</h4>
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 联系我们 */}
      <div className="px-4 mt-6">
        <h3 className="text-base font-medium text-gray-900 mb-3">联系我们</h3>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">邮箱</div>
                <div className="text-sm font-medium text-gray-900">jaysakura@163.com</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Globe className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">官方网站</div>
                <div className="text-sm font-medium text-gray-900">部署地址待配置</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 底部信息 */}
      <div className="px-4 mt-8 text-center">
        <p className="text-xs text-gray-400 mb-2">慢病用药小管家团队 出品</p>
        <p className="text-xs text-gray-400">© 2026 All Rights Reserved</p>
        <div className="flex justify-center gap-4 mt-3 text-xs text-gray-400">
          <span>用户协议</span>
          <span>·</span>
          <span>隐私政策</span>
        </div>
      </div>
    </div>
  );
};

export default About;
