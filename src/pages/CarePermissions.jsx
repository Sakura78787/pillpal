import { useEffect, useState } from 'react';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createCareAuthorization, getOwnedCareAuthorizations, revokeCareAuthorization } from '@/api/care';
import { useAuthStore } from '@/store/authStore';

export default function CarePermissions() {
  const navigate = useNavigate(); const { user } = useAuthStore(); const [email, setEmail] = useState(''); const [items, setItems] = useState([]); const [busy, setBusy] = useState(false);
  const refresh = () => user?.id && getOwnedCareAuthorizations(user.id).then(setItems).catch(() => toast.error('读取授权列表失败'));
  useEffect(() => { refresh(); }, [user?.id]);
  const create = async () => { if (!window.confirm(`确认授权 ${email.trim()} 查看你的照护摘要吗？对方登录后自动生效，可随时撤销。`)) return; setBusy(true); try { await createCareAuthorization(email); setEmail(''); toast.success('已记录授权，等待对方登录'); refresh(); } catch (error) { toast.error(error.message === 'CARE_AUTHORIZATION_SELF_NOT_ALLOWED' ? '不能授权给自己的登录邮箱' : '创建授权失败，请检查邮箱后重试'); } finally { setBusy(false); } };
  const revoke = async (id) => { try { await revokeCareAuthorization(id); toast.success('已撤销授权'); refresh(); } catch { toast.error('撤销失败，请稍后重试'); } };
  return <div className="min-h-screen bg-gray-50 p-4 pb-24"><Button variant="ghost" onClick={() => navigate('/profile')} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />返回我的</Button><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-emerald-600" />授权管理</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm leading-6 text-gray-600">填写家人的登录邮箱。对方使用该邮箱登录后，可只读查看照护摘要、生成 AI 家庭照护周报，并发送固定服药提醒；不能编辑你的任何记录。</p><div className="flex gap-2"><Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="家人登录邮箱" /><Button disabled={!email.trim() || busy} onClick={create}>授权</Button></div></CardContent></Card><div className="mt-4 space-y-3">{items.map((item) => <Card key={item.id}><CardContent className="flex items-center gap-3 p-4"><Mail className="h-5 w-5 text-gray-400" /><div className="flex-1"><p className="font-medium">{item.caregiver_email_normalized}</p><p className="text-xs text-gray-500">{item.status === 'active' ? '已生效' : '等待对方登录'}</p></div><Button size="sm" variant="outline" onClick={() => revoke(item.id)}>撤销</Button></CardContent></Card>)}</div></div>;
}
