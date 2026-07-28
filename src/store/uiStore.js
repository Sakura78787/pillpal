import { create } from 'zustand';

const getLocalSetting = (key, defaultValue = null) => {
  const rawValue = localStorage.getItem(key);
  if (rawValue === null) return defaultValue;

  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
};

const setLocalSetting = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

/**
 * UI状态管理Store
 * 管理界面相关的状态：主题、字体大小、加载状态、提示信息等
 */
export const useUIStore = create((set, get) => ({
  // 主题状态
  theme: 'light',
  fontSize: 'standard', // standard / large / xlarge
  
  // 全局加载状态
  isGlobalLoading: false,
  globalLoadingText: '',
  
  // 提示信息
  toast: {
    show: false,
    message: '',
    type: 'info', // success / error / warning / info
    duration: 3000
  },
  
  // 底部导航当前选中
  activeTab: 'home',
  
  // 页面标题
  pageTitle: '',
  
  // 网络状态
  isOnline: navigator.onLine,
  lastSyncTime: null,

  // 初始化UI设置
  initializeUI: async () => {
    try {
      // 从本地加载设置
      const savedTheme = getLocalSetting('theme', 'light');
      const savedFontSize = getLocalSetting('font_size', 'standard');
      const lastSync = getLocalSetting('last_sync_time', null);
      
      set({ 
        theme: savedTheme,
        fontSize: savedFontSize,
        lastSyncTime: lastSync
      });

      // 应用字体大小到DOM
      get().applyFontSize(savedFontSize);
      
      // 监听网络状态
      window.addEventListener('online', () => set({ isOnline: true }));
      window.addEventListener('offline', () => set({ isOnline: false }));
      
      console.log('[UIStore] UI设置已初始化');
    } catch (error) {
      console.error('[UIStore] 初始化失败:', error);
    }
  },

  // 切换主题
  setTheme: async (theme) => {
    set({ theme });
    setLocalSetting('theme', theme);
    
    // 应用到DOM
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  // 设置字体大小
  setFontSize: async (fontSize) => {
    set({ fontSize });
    setLocalSetting('font_size', fontSize);
    get().applyFontSize(fontSize);
  },

  // 应用字体大小到DOM
  applyFontSize: (fontSize) => {
    const root = document.documentElement;
    root.classList.remove('text-size-standard', 'text-size-large', 'text-size-xlarge');
    root.classList.add(`text-size-${fontSize}`);
    
    // 设置CSS变量
    const sizes = {
      standard: { base: '16px', scale: 1 },
      large: { base: '18px', scale: 1.125 },
      xlarge: { base: '20px', scale: 1.25 }
    };
    
    const size = sizes[fontSize] || sizes.standard;
    root.style.setProperty('--font-size-base', size.base);
    root.style.setProperty('--font-scale', size.scale);
  },

  // 设置全局加载状态
  setGlobalLoading: (isLoading, text = '') => {
    set({ isGlobalLoading: isLoading, globalLoadingText: text });
  },

  // 显示提示
  showToast: (message, type = 'info', duration = 3000) => {
    set({ 
      toast: { show: true, message, type, duration } 
    });
    
    // 自动隐藏
    setTimeout(() => {
      set(state => ({ 
        toast: { ...state.toast, show: false } 
      }));
    }, duration);
  },

  // 隐藏提示
  hideToast: () => {
    set(state => ({ 
      toast: { ...state.toast, show: false } 
    }));
  },

  // 设置当前选中的Tab
  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  // 设置页面标题
  setPageTitle: (title) => {
    set({ pageTitle: title });
    // 同步更新document title
    document.title = title ? `${title} - 慢病用药小管家` : '慢病用药小管家';
  },

  // 更新最后同步时间
  setLastSyncTime: async (time) => {
    const syncTime = time || new Date().toISOString();
    set({ lastSyncTime: syncTime });
    setLocalSetting('last_sync_time', syncTime);
  },

  // 获取同步状态文本
  getSyncStatusText: () => {
    const { isOnline, lastSyncTime } = get();
    
    if (!isOnline) {
      return '网络不可用';
    }
    
    if (!lastSyncTime) {
      return '尚未在线加载';
    }
    
    const lastSync = new Date(lastSyncTime);
    const now = new Date();
    const diffMinutes = Math.floor((now - lastSync) / (1000 * 60));
    
    if (diffMinutes < 1) {
      return '刚刚在线加载';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分钟前在线加载`;
    } else if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)}小时前在线加载`;
    } else {
      return `${Math.floor(diffMinutes / 1440)}天前在线加载`;
    }
  }
}));
