import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  guestSessionRepository,
  subscribeGuestSessionPersistence,
} from '@/features/guest-experience/guestSession';

const GuestExperienceBanner = () => {
  const [persistence, setPersistence] = useState(() => guestSessionRepository.read().persistence);

  useEffect(() => subscribeGuestSessionPersistence(setPersistence), []);

  const storageNote = persistence === 'memory'
    ? '浏览器无法保留会话，刷新后将重置。'
    : '数据仅在当前标签页会话内保留，不上传云端。';

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs leading-5 text-amber-900">
      访客体验：{storageNote} 请勿输入真实健康或处方信息。{' '}
      <Link to="/login" className="font-medium underline">登录使用云端版</Link>
    </div>
  );
};

export default GuestExperienceBanner;
