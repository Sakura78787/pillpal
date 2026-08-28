import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { AuthStatus } from '@/types/auth';

/**
 * 默认数据管理Hook
 * 为新用户展示默认示例数据，用户添加真实数据后不再显示
 */
export const useDefaultData = (dataType) => {
  const { user, authStatus } = useAuthStore();
  const [hasRealData, setHasRealData] = useState(false);
  
  // 检查用户是否已有真实数据
  useEffect(() => {
    if (!user?.id) return;
    if (authStatus === AuthStatus.GUEST) {
      setHasRealData(true);
      return;
    }
    
    const checkRealData = async () => {
      const flagKey = `has_real_${dataType}_${user.id}`;
      const hasFlag = localStorage.getItem(flagKey);
      setHasRealData(!!hasFlag);
    };
    
    checkRealData();
  }, [user, dataType, authStatus]);
  
  // 标记用户已添加真实数据
  const markHasRealData = () => {
    if (!user?.id) return;
    if (authStatus === AuthStatus.GUEST) {
      setHasRealData(true);
      return;
    }
    const flagKey = `has_real_${dataType}_${user.id}`;
    localStorage.setItem(flagKey, 'true');
    setHasRealData(true);
  };
  
  return { hasRealData, markHasRealData };
};

/**
 * 生成默认用药计划数据
 */
export const getDefaultMedications = (userId) => [
  {
    id: 'demo_med_1',
    user_id: userId,
    name: '阿托伐他汀钙片',
    dosage: '1',
    unit: '片',
    frequency_type: 'daily',
    frequency_config: { dailyTimes: 1 },
    reminder_times: ['20:00'],
    meal_timing: 'after_meal',
    stock_quantity: 14,
    stock_unit: '片',
    low_stock_threshold: 7,
    status: 'active',
    notes: '用于降血脂，晚餐后服用',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_demo: true
  },
  {
    id: 'demo_med_2',
    user_id: userId,
    name: '苯磺酸氨氯地平片',
    dosage: '1',
    unit: '片',
    frequency_type: 'daily',
    frequency_config: { dailyTimes: 1 },
    reminder_times: ['08:00'],
    meal_timing: 'before_meal',
    stock_quantity: 21,
    stock_unit: '片',
    low_stock_threshold: 7,
    status: 'active',
    notes: '用于降血压，晨起空腹服用',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_demo: true
  }
];

/**
 * 生成默认复诊预约数据
 */
export const getDefaultAppointments = (userId) => [
  {
    id: 'demo_app_1',
    user_id: userId,
    hospital_name: '市第一人民医院',
    department: '心内科',
    doctor_name: '张医生',
    appointment_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    appointment_time: '09:00',
    is_first_visit: false,
    status: 'scheduled',
    checkup_items: ['血压测量', '血脂检查', '心电图'],
    reminder_days: 3,
    notes: '带齐近期检查报告',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_demo: true
  }
];

/**
 * 生成默认健康记录数据
 */
export const getDefaultHealthRecords = (userId) => [
  {
    id: 'demo_health_1',
    user_id: userId,
    record_type: 'blood_pressure',
    values: { systolic: 128, diastolic: 82, heart_rate: 72 },
    recorded_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    note: '晨起测量',
    created_at: new Date().toISOString(),
    is_demo: true
  },
  {
    id: 'demo_health_2',
    user_id: userId,
    record_type: 'blood_sugar',
    values: { value: 5.8, timing: 'fasting' },
    recorded_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    note: '空腹测量',
    created_at: new Date().toISOString(),
    is_demo: true
  },
  {
    id: 'demo_health_3',
    user_id: userId,
    record_type: 'weight',
    values: { value: 65.5, height: 170, bmi: 22.7 },
    recorded_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    note: '晨起空腹测量',
    created_at: new Date().toISOString(),
    is_demo: true
  }
];

/**
 * 生成默认服药记录
 */
export const getDefaultLogs = (userId, dateStr) => [
  {
    id: 'demo_log_1',
    medication_id: 'demo_med_1',
    user_id: userId,
    scheduled_date: dateStr,
    scheduled_time: '08:00',
    taken_at: new Date().toISOString(),
    status: 'taken',
    feeling_score: 5,
    note: '',
    created_at: new Date().toISOString(),
    is_demo: true
  }
];

/**
 * 健康指标标准范围
 */
export const HEALTH_STANDARDS = {
  blood_pressure: {
    systolic: { min: 90, max: 120, unit: 'mmHg', label: '收缩压' },
    diastolic: { min: 60, max: 80, unit: 'mmHg', label: '舒张压' },
    heart_rate: { min: 60, max: 100, unit: '次/分', label: '心率' }
  },
  blood_sugar: {
    fasting: { min: 3.9, max: 6.1, unit: 'mmol/L', label: '空腹血糖' },
    post_meal: { min: 3.9, max: 7.8, unit: 'mmol/L', label: '餐后血糖' },
    random: { min: 3.9, max: 11.1, unit: 'mmol/L', label: '随机血糖' }
  },
  weight: {
    bmi: { min: 18.5, max: 24, unit: '', label: 'BMI' }
  }
};

/**
 * 检查健康指标是否在正常范围
 */
export const checkHealthValue = (type, values) => {
  const warnings = [];
  
  if (type === 'blood_pressure') {
    const { systolic, diastolic, heart_rate } = values;
    const standard = HEALTH_STANDARDS.blood_pressure;
    
    if (systolic && (systolic < standard.systolic.min || systolic > standard.systolic.max)) {
      if (systolic > 140) {
        warnings.push(`收缩压 ${systolic} 偏高，正常范围 ${standard.systolic.min}-${standard.systolic.max} ${standard.systolic.unit}`);
      } else if (systolic < 90) {
        warnings.push(`收缩压 ${systolic} 偏低，正常范围 ${standard.systolic.min}-${standard.systolic.max} ${standard.systolic.unit}`);
      }
    }
    
    if (diastolic && (diastolic < standard.diastolic.min || diastolic > standard.diastolic.max)) {
      if (diastolic > 90) {
        warnings.push(`舒张压 ${diastolic} 偏高，正常范围 ${standard.diastolic.min}-${standard.diastolic.max} ${standard.diastolic.unit}`);
      } else if (diastolic < 60) {
        warnings.push(`舒张压 ${diastolic} 偏低，正常范围 ${standard.diastolic.min}-${standard.diastolic.max} ${standard.diastolic.unit}`);
      }
    }
    
    if (heart_rate && (heart_rate < standard.heart_rate.min || heart_rate > standard.heart_rate.max)) {
      if (heart_rate > 100) {
        warnings.push(`心率 ${heart_rate} 偏快，正常范围 ${standard.heart_rate.min}-${standard.heart_rate.max} ${standard.heart_rate.unit}`);
      } else if (heart_rate < 60) {
        warnings.push(`心率 ${heart_rate} 偏慢，正常范围 ${standard.heart_rate.min}-${standard.heart_rate.max} ${standard.heart_rate.unit}`);
      }
    }
  }
  
  if (type === 'blood_sugar') {
    const { value, timing = 'fasting' } = values;
    const standard = HEALTH_STANDARDS.blood_sugar[timing] || HEALTH_STANDARDS.blood_sugar.fasting;
    
    if (value && (value < standard.min || value > standard.max)) {
      if (value > standard.max) {
        warnings.push(`${standard.label} ${value} 偏高，正常范围 ${standard.min}-${standard.max} ${standard.unit}`);
      } else if (value < standard.min) {
        warnings.push(`${standard.label} ${value} 偏低，正常范围 ${standard.min}-${standard.max} ${standard.unit}`);
      }
    }
  }
  
  if (type === 'weight') {
    const { bmi } = values;
    if (bmi && (bmi < HEALTH_STANDARDS.weight.bmi.min || bmi > HEALTH_STANDARDS.weight.bmi.max)) {
      if (bmi > 24) {
        warnings.push(`BMI ${bmi} 超重，健康范围 ${HEALTH_STANDARDS.weight.bmi.min}-${HEALTH_STANDARDS.weight.bmi.max}`);
      } else if (bmi < 18.5) {
        warnings.push(`BMI ${bmi} 偏瘦，健康范围 ${HEALTH_STANDARDS.weight.bmi.min}-${HEALTH_STANDARDS.weight.bmi.max}`);
      }
    }
  }
  
  return warnings;
};
