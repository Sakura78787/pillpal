const LOCAL_ONLY_FIELDS = new Set([
  'id',
  'is_demo',
  'synced_at',
  '_time',
  '_timeIndex',
  'stockStatus',
  'perDose',
]);

export const assertUserId = (userId) => {
  if (!userId) {
    throw new Error('请先登录');
  }
  return userId;
};

export const cleanMutationPayload = (payload = {}) => {
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => {
      return value !== undefined && !LOCAL_ONLY_FIELDS.has(key);
    })
  );
};

export const getErrorMessage = (error, fallback = '保存失败，请稍后重试') => {
  if (!error) return fallback;
  return error.message || error.error_description || fallback;
};

export const todayString = () => toLocalDateKey();
import { toLocalDateKey } from './dateTime';
