/**
 * 认证相关类型定义
 * @description 定义用户认证流程中的类型
 */

// 用户认证状态
export const AuthStatus = {
  UNAUTHENTICATED: 'unauthenticated',
  AUTHENTICATING: 'authenticating',
  AUTHENTICATED: 'authenticated',
  GUEST: 'guest',
  ERROR: 'error'
};

// 登录方式
export const LoginMethod = {
  PHONE_OTP: 'phone_otp',
  EMAIL_OTP: 'email_otp'
};

// 用户角色
export const UserRole = {
  PRIMARY: 'primary',
  SUB: 'sub',
  VIEWER: 'viewer'
};

// 验证码状态
export const OtpStatus = {
  IDLE: 'idle',
  SENDING: 'sending',
  SENT: 'sent',
  VERIFYING: 'verifying',
  VERIFIED: 'verified',
  ERROR: 'error'
};

// 用户信息类型
export const UserProfile = {
  id: '',
  userId: '',
  username: '',
  phone: '',
  email: '',
  avatarUrl: '',
  chronicDiseases: [],
  emergencyContact: {},
  settings: {},
  accountType: 'primary',
  parentAccountId: null,
  permissions: {},
  createdAt: '',
  updatedAt: ''
};
