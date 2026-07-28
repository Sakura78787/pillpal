import { useEffect, useState } from 'react';

/**
 * 进度环组件
 * 中央显示完成百分比，环形进度条
 */
const ProgressRing = ({ 
  progress, 
  size = 120, 
  strokeWidth = 10, 
  total = 0, 
  completed = 0 
}) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  // 确保进度在0-100之间
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  
  // 动画效果
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(normalizedProgress);
    }, 100);
    return () => clearTimeout(timer);
  }, [normalizedProgress]);

  // 计算圆环参数
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (animatedProgress / 100) * circumference;
  
  // 根据进度获取颜色
  const getProgressColor = () => {
    if (progress >= 80) return '#10B981'; // 健康绿
    if (progress >= 50) return '#EAB308'; // 警告黄
    return '#EF4444'; // 危险红
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* 背景圆环 */}
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
        />
        {/* 进度圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getProgressColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 0.5s ease-in-out, stroke 0.3s ease'
          }}
        />
      </svg>
      
      {/* 中央文字 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-900">
          {Math.round(animatedProgress)}%
        </span>
        <span className="text-xs text-gray-500 mt-1">
          {completed}/{total}
        </span>
      </div>
    </div>
  );
};

export default ProgressRing;
