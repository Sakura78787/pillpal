import { Link } from 'react-router-dom';

const GuestExperienceBanner = () => (
  <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs leading-5 text-amber-900">
    访客体验：数据仅在当前标签页会话内保留，不上传云端。请勿输入真实健康或处方信息。{' '}
    <Link to="/login" className="font-medium underline">登录使用云端版</Link>
  </div>
);

export default GuestExperienceBanner;
