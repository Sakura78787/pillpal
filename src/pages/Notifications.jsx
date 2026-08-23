import { useEffect, useState } from 'react';
import { ArrowLeft, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { loadNotifications, markNotificationsRead, syncNotifications } from '@/api/notifications';
import { requireSupabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';

export default function Notifications() {
  const navigate = useNavigate(); const { user } = useAuthStore(); const [items, setItems] = useState([]);
  const refresh = async () => { if (!user?.id) return; await syncNotifications().catch(() => {}); setItems(await loadNotifications(user.id)); };
  useEffect(() => { refresh(); if (!user?.id) return undefined; const channel = requireSupabase().channel(`notifications:${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${user.id}` }, refresh).subscribe(); return () => requireSupabase().removeChannel(channel); }, [user?.id]);
  const open = async (item) => { if (!item.read_at) { await markNotificationsRead([item.id]); await refresh(); } navigate(item.link); };
  const markAll = async () => { await markNotificationsRead(items.filter((item) => !item.read_at).map((item) => item.id)); refresh(); };
  return <div className="min-h-screen bg-gray-50 p-4 pb-24"><div className="mb-4 flex items-center justify-between"><Button variant="ghost" onClick={() => navigate('/dashboard')}><ArrowLeft className="mr-2 h-4 w-4" />返回首页</Button><Button variant="ghost" onClick={markAll}>全部已读</Button></div><h1 className="mb-4 flex items-center gap-2 text-xl font-semibold"><Bell className="h-5 w-5 text-emerald-600" />站内通知</h1><div className="space-y-3">{items.length ? items.map((item) => <Card key={item.id} className={item.read_at ? 'opacity-70' : 'border-emerald-200'} onClick={() => open(item)}><CardContent className="cursor-pointer p-4"><p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-gray-600">{item.body}</p><p className="mt-2 text-xs text-gray-400">{new Date(item.created_at).toLocaleString()}</p></CardContent></Card>) : <Card><CardContent className="p-6 text-sm text-gray-500">暂无需要查看的站内通知。</CardContent></Card>}</div></div>;
}
