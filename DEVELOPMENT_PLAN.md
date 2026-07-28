# 慢病用药小管家 - 开发执行文档

**文档版本**: V1.2  
**创建日期**: 2026.04.24  
**修订日期**: 2026.04.24  
**技术负责人**: NoCode  
**执行策略**: 分阶段验收，渐进式交付，性价比优先

---

## 🎯 开发总览

本文档将产品开发拆分为 **可独立验收的步骤**，采用"**核心功能优先，体验包装在后，成本可控**"的策略。

**重要说明**：
- 本文档已整合架构师评审后的优化方案
- **离线存储采用Dexie.js**（比原生IndexedDB更易用，开发效率高）
- **MVP功能暂不实装**，优先保证核心用药管理闭环可用

---

## 📋 执行路线图

```
Phase 1: 基础架构 (Steps 1-3)
├── Step 1: 数据库设计与迁移
├── Step 2: 认证体系与家人账户基础
└── Step 3: 全局状态管理Store + Dexie离线存储搭建

Phase 2: 核心功能 (Steps 4-8) - 【优先级最高，务必保证质量】
├── Step 4: 今日用药看板（首页）
├── Step 5: 用药计划CRUD
├── Step 6: 服药打卡系统
├── Step 7: 库存管理与预警
└── Step 8: 复诊预约基础功能

Phase 3: 数据与健康 (Steps 9-10) - 【性价比阶段，简化实现】
├── Step 9: 健康数据中心（简化版）
└── Step 10: 数据备份与导出

Phase 4: 体验优化 (Steps 11-13) - 【后续迭代，当前阶段不做】
├── Step 11: 智能提醒与通知（基础版）
├── Step 12: 家人账户与权限管理（基础绑定）
└── Step 13: 温暖动效落地页
```

**开发原则**：
- ✅ Phase 1-2 必须高质量完成（核心闭环）
- ⚠️ Phase 3 简化实现（能用即可，不追求完美）
- ❌ Phase 4 当前阶段不做（后续版本迭代）

---

## Phase 1: 基础架构搭建

### Step 1: 数据库设计与迁移

**目标**: 建立Supabase数据库表结构，支撑核心业务流程

**涉及文件**:
- `src/supabase/migrations/001_create_profiles.sql`
- `src/supabase/migrations/002_create_medications.sql`
- `src/supabase/migrations/003_create_medication_logs.sql`
- `src/supabase/migrations/004_create_health_records.sql`
- `src/supabase/migrations/005_create_appointments.sql`

**表结构详情**:

1. **profiles** (用户扩展表)
   - id (uuid, PK, 关联auth.users)
   - username, phone, avatar_url
   - chronic_diseases (JSON数组)
   - emergency_contact (JSON)
   - settings (JSON)
   - created_at, updated_at

2. **medications** (用药计划表)
   - id (int8, PK, auto increment)
   - user_id (uuid, FK)
   - name, dosage, unit
   - frequency_type, frequency_config (JSON)
   - reminder_times (JSON数组)
   - stock_quantity, low_stock_threshold
   - status (active/paused/completed)
   - created_at, updated_at

3. **medication_logs** (服药记录表)
   - id (int8, PK)
   - medication_id, user_id
   - scheduled_date, scheduled_time
   - taken_at, status
   - created_at

4. **health_records** (健康记录表，简化版)
   - id (int8, PK)
   - user_id, record_type, values (JSON)
   - recorded_at
   - created_at

5. **appointments** (复诊预约表)
   - id (int8, PK)
   - user_id, hospital_name, department
   - appointment_date, appointment_time
   - status, reminder_days
   - created_at

**验收标准**:
- [ ] 所有5个表在Supabase中成功创建
- [ ] 基础RLS策略配置完成
- [ ] 测试数据可正常插入/查询

---

### Step 2: 认证体系基础

**目标**: 实现手机号+验证码认证

**涉及文件**:
- `src/integrations/supabase/client.js` (Supabase客户端检查)
- `src/api/auth.js` (认证相关API)
- `src/types/auth.js` (认证类型定义)

**功能细节**:

1. **认证方式实现**
   - 手机号+验证码登录
   - 验证码5分钟有效，60秒后可重发

2. **账户基础信息**
   - 登录后自动创建/获取profile
   - 支持修改用户名、头像

**验收标准**:
- [ ] 手机号验证码登录流程正常
- [ ] 登录后正确获取用户信息
- [ ] 新用户自动创建profile记录

---

### Step 3: 全局状态管理Store + Dexie离线存储搭建

**目标**: 建立Zustand状态管理 + Dexie.js离线存储，实现核心数据离线可用

**涉及文件**:
- `src/store/index.js` (Store组合)
- `src/store/authStore.js` (用户认证状态)
- `src/store/medicationStore.js` (用药计划状态)
- `src/store/logStore.js` (服药记录状态)
- `src/store/uiStore.js` (UI状态)
- `src/lib/db.js` (Dexie数据库定义，新增)
- `src/hooks/useSync.js` (数据同步Hook，新增)

**Dexie.js数据库设计**:

```javascript
// src/lib/db.js
import Dexie from 'dexie';

export const db = new Dexie('MediCareDB');

db.version(1).stores({
  // 用药计划本地缓存
  medications: '++id, user_id, name, status, updated_at',
  
  // 服药记录（支持离线打卡，联网后同步）
  medication_logs: '++id, medication_id, user_id, scheduled_date, status, synced_at',
  
  // 健康记录本地缓存
  health_records: '++id, user_id, record_type, recorded_at, synced_at',
  
  // 同步队列（离线操作暂存）
  sync_queue: '++id, table_name, operation, data, created_at',
  
  // 用户设置
  settings: 'key, value'
});

// 同步队列操作方法
export const addToSyncQueue = async (table, operation, data) => {
  await db.sync_queue.add({
    table_name: table,
    operation: operation, // 'create' | 'update' | 'delete'
    data: data,
    created_at: new Date().toISOString()
  });
};

// 执行同步
export const processSyncQueue = async (supabaseClient) => {
  const items = await db.sync_queue.orderBy('created_at').toArray();
  
  for (const item of items) {
    try {
      const { error } = await supabaseClient
        .from(item.table_name)
        [item.operation](item.data);
      
      if (!error) {
        await db.sync_queue.delete(item.id);
      }
    } catch (err) {
      console.error('Sync failed:', err);
      // 保留在队列中，下次重试
    }
  }
};
```

**Store设计规范**:

```javascript
// 示例: medicationStore（含Dexie集成）
export const useMedicationStore = create((set, get) => ({
  medications: [],
  isLoading: false,
  
  // 从Dexie获取本地数据
  loadFromLocal: async () => {
    const localData = await db.medications.toArray();
    set({ medications: localData });
  },
  
  // 添加用药计划（离线优先）
  addMedication: async (data) => {
    // 1. 先存本地
    const localId = await db.medications.add({
      ...data,
      updated_at: new Date().toISOString()
    });
    
    // 2. 更新UI状态
    await get().loadFromLocal();
    
    // 3. 加入同步队列（后台同步到Supabase）
    await addToSyncQueue('medications', 'insert', {
      ...data,
      local_id: localId
    });
  },
  
  // 同步到云端
  syncToCloud: async (supabase) => {
    set({ isLoading: true });
    await processSyncQueue(supabase);
    // 拉取云端最新数据...
    set({ isLoading: false });
  }
}));
```

**验收标准**:
- [ ] Dexie数据库初始化成功
- [ ] Store可从Dexie读取本地数据
- [ ] 离线状态下可添加/修改数据（进入同步队列）
- [ ] 联网后数据正确同步到Supabase
- [ ] 同步失败的数据保留在队列中，可重试

---

## Phase 2: 核心功能开发（优先级最高）

### Step 4: 今日用药看板（首页）

**目标**: 实现PRD核心页面 - 今日用药看板，用户打开APP的第一屏

**涉及文件**:
- `src/pages/Dashboard.jsx` (今日用药主页面)
- `src/components/dashboard/DateNavigator.jsx` (日期切换)
- `src/components/dashboard/MedicationCard.jsx` (药物卡片)
- `src/components/dashboard/ProgressRing.jsx` (进度环)
- `src/components/dashboard/TimeGroup.jsx` (时段分组)

**功能细节**:

1. **日期导航器**
   - 左右箭头切换日期
   - 显示"今天/昨天/明天"或具体日期

2. **今日进度环**
   - 中央显示完成百分比
   - 环形进度条

3. **时段分组展示**
   - 早/中/晚/睡前四个时段
   - 每个时段显示对应药物卡片

4. **药物卡片**
   - 显示药物名称、剂量、时间
   - "确认服用"按钮
   - 长按显示编辑/删除菜单

**验收标准**:
- [ ] 页面加载显示当日用药计划
- [ ] 左右切换日期，数据正确更新
- [ ] 点击"确认服用"后，卡片状态变化，进度环更新
- [ ] 离线状态下打卡数据进入同步队列

---

### Step 5: 用药计划CRUD

**目标**: 完整的用药计划增删改查功能

**涉及文件**:
- `src/pages/Medications.jsx` (用药计划列表页)
- `src/pages/AddMedication.jsx` (添加药物页面)
- `src/components/medications/MedicationForm.jsx` (药物表单)
- `src/components/medications/FrequencySelector.jsx` (频次选择器)

**功能细节**:

1. **用药计划列表**
   - 按状态分组(服用中/已暂停)
   - 显示药物名称、下次服用时间、剩余库存

2. **添加药物流程** (分步表单)
   - Step 1: 基础信息 - 药名、剂量
   - Step 2: 服用频次 - 每日几次
   - Step 3: 服用时间 - 具体时间点
   - Step 4: 库存设置 - 当前库存、预警阈值

3. **编辑与删除**
   - 修改计划信息
   - 删除时二次确认

**验收标准**:
- [ ] 可成功添加新的用药计划
- [ ] 表单验证完整，错误提示清晰
- [ ] 编辑现有计划，数据回显正确
- [ ] 离线添加的计划进入同步队列

---

### Step 6: 服药打卡系统

**目标**: 实现完整的服药打卡与记录功能

**涉及文件**:
- `src/components/dashboard/CheckInModal.jsx` (打卡弹窗)
- `src/pages/Logs.jsx` (服药记录历史页)
- `src/components/logs/LogCalendar.jsx` (打卡日历)

**功能细节**:

1. **打卡弹窗**
   - 确认药物信息
   - 选择服用时间(默认当前)
   - 确认后生成服药记录

2. **跳过服药流程**
   - 选择跳过原因
   - 系统记录跳过行为

3. **服药记录历史**
   - 日历视图: 月历形式展示
   - 列表视图: 按时间倒序展示

**验收标准**:
- [ ] 打卡后数据正确保存，Dashboard进度更新
- [ ] 可查看历史服药记录
- [ ] 日历视图正确显示服药情况
- [ ] 离线打卡数据进入同步队列

---

### Step 7: 库存管理与预警

**目标**: 实现药品库存跟踪与低库存预警

**涉及文件**:
- `src/components/inventory/StockManager.jsx` (库存管理组件)
- `src/components/inventory/StockAlert.jsx` (库存预警组件)
- `src/pages/Inventory.jsx` (库存总览页面)

**功能细节**:

1. **库存展示**
   - 列表展示所有药品当前库存
   - 按库存余量排序
   - 颜色标识: 充足(绿)/预警(黄)/告急(红)

2. **库存更新**
   - 快速更新: 点击 +/- 调整数量
   - 自动扣减: 根据打卡记录自动减少

3. **预警系统**
   - 低库存时Dashboard显示预警卡片
   - 设置页面可配置预警阈值（7/15/30天）

**验收标准**:
- [ ] 库存数量正确显示
- [ ] 打卡后库存自动扣减
- [ ] 低库存时显示预警提示
- [ ] 可手动调整库存数量

---

### Step 8: 复诊预约基础功能

**目标**: 实现复诊管理与基础提醒功能（简化版）

**涉及文件**:
- `src/pages/Appointments.jsx` (复诊中心主页)
- `src/components/appointments/AppointmentList.jsx` (预约列表)
- `src/components/appointments/AppointmentForm.jsx` (预约表单)

**功能细节**:

1. **复诊列表**
   - 按状态分组(待复诊/已完成)
   - 显示医院、科室、时间

2. **添加复诊**
   - 医院/科室/医生信息录入
   - 选择复诊日期时间
   - 设置提前提醒天数

3. **基础提醒**
   - 到提醒日期显示在Dashboard
   - 简单的本地通知（如有权限）

**验收标准**:
- [ ] 可添加新的复诊预约
- [ ] 复诊列表正确显示和排序
- [ ] 到提醒日期在首页显示提醒

---

## Phase 3: 数据与健康（简化版）

### Step 9: 健康数据中心（简化版）

**目标**: 实现基础健康指标记录与简单展示（不追求复杂图表）

**涉及文件**:
- `src/pages/Health.jsx` (健康数据中心)
- `src/components/health/RecordForm.jsx` (数据记录表单)
- `src/components/health/HealthCards.jsx` (指标卡片)

**功能细节**:

1. **指标卡片**
   - 血压、血糖、体重等核心指标
   - 显示最新数值

2. **数据记录**
   - 血压: 收缩压/舒张压/心率
   - 血糖: 空腹/餐后2小时
   - 体重

3. **简单趋势**
   - 最近7天的数值列表
   - （暂不实现复杂图表，降低成本）

**验收标准**:
- [ ] 可记录各类健康指标
- [ ] 显示最新数值
- [ ] 可查看最近7天记录

---

### Step 10: 数据备份与导出

**目标**: 实现基础数据导出功能（不实现自动备份和恢复）

**涉及文件**:
- `src/pages/Settings.jsx` (设置页面)
- `src/components/settings/DataExport.jsx` (数据导出组件)

**功能细节**:

1. **数据导出**
   - JSON格式导出所有数据
   - 可下载到本地

2. **数据清除**
   - 清除本地缓存
   - 退出登录

**验收标准**:
- [ ] 可导出JSON格式数据
- [ ] 退出登录时清除本地数据

---

## Phase 4: 体验优化（后续迭代，当前阶段不做）

以下功能**当前阶段不实现**，记录为后续迭代方向：

### Step 11: 智能提醒与通知（基础版已有，高级版后续做）
- 暂不实现：三级提醒机制、短信提醒、紧急联系人通知
- 基础版：简单的本地通知（浏览器/系统通知）

### Step 12: 家人账户与权限管理（后续迭代）
- 暂不实现：复杂的权限体系、账户切换
- 基础版：简单的数据分享（二维码/链接分享）

### Step 13: 温暖动效落地页（后续迭代）
- 暂不实现：全屏滚动动效、粒子效果
- 基础版：简单的静态产品介绍页

---

## 📊 验收流程规范

每个Step完成后，按以下流程验收:

```
1. 功能演示 (5分钟)
   └── 展示该Step核心功能点

2. 代码审查 (3分钟)
   └── 检查代码结构和规范

3. 测试验证 (3分钟)
   └── 按验收标准逐项确认
   └── 重点验证离线功能是否正常

4. 确认签字
   └── 双方确认Step完成，进入下一阶段
```

---

## 🎨 设计资源

### 颜色Token (Tailwind配置扩展)

```javascript
// tailwind.config.js 扩展
colors: {
  brand: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#10B981',  // 主色-健康绿
    600: '#059669',
    700: '#047857',
  },
  warm: {
    50: '#FFF7ED',
    100: '#FFEDD5',
    200: '#FED7AA',
    300: '#FDBA74',
    400: '#FB923C',
    500: '#F97316',  // 辅助色-温暖橙
    600: '#EA580C',
  }
}
```

---

## 📦 依赖清单

**已安装核心依赖**:
- `framer-motion` - 动画库 ✓
- `lucide-react` - 图标库 ✓
- `recharts` - 图表库 ✓
- `date-fns` - 日期处理 ✓
- `@tanstack/react-query` - 数据获取 ✓
- `zustand` - 状态管理 (需确认)
- `react-hook-form` - 表单处理 ✓
- `zod` - 校验库 ✓
- `@supabase/supabase-js` - 数据库 ✓
- `dexie` - 离线存储 ✓（本次添加）

**后续可选依赖**（Phase 3之后）:
- `qrcode.react` - 二维码生成
- `jspdf` - PDF生成

---

## 🚀 开始开发

### 第一步准备

确认以下配置正确:

1. Supabase项目已创建，URL和Key配置在 `src/integrations/supabase/client.js`
2. Dexie.js已安装
3. 开发服务器可正常启动
4. 数据库迁移文件已准备就绪