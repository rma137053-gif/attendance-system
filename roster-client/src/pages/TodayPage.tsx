import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/Spinner';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  createdAt: string;
}

interface RosterNotification {
  id: string;
  userName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
}

const NOTIFY_KEY = 'roster_last_notify';

interface RosterUser {
  id: string;
  name: string;
}

interface TodayData {
  myShift: {
    id: string;
    startTime: string;
    endTime: string;
    shiftDate: string;
    user: RosterUser;
    overtimeMinutes?: number;
  } | null;
  overview?: {
    id: string;
    startTime: string;
    endTime: string;
    user: RosterUser;
    store?: { id: string; name: string };
    overtimeMinutes?: number;
  }[];
  colleagues: { id: string; name: string; startTime: string; endTime: string }[];
  handoverFrom: { id: string; user: RosterUser; startTime: string; endTime: string }[] | null;
  handoverTo: { id: string; user: RosterUser; startTime: string; endTime: string }[] | null;
  handoverNotes: { id: string; content: string; author: { id: string; name: string }; createdAt: string }[];
}

export default function TodayPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<RosterNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifiedRef = useRef(false);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'STORE_ADMIN';

  useEffect(() => {
    api.get('/roster/today')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch announcements
    api.get('/announcements', { params: { page: 1, pageSize: 3 } })
      .then((res) => setAnnouncements(res.data.items))
      .catch(() => {});

    // Poll roster notifications
    const pollNotifications = async () => {
      try {
        const lastCheck = localStorage.getItem(NOTIFY_KEY) || '';
        const res = await api.get('/roster/notifications', { params: { since: lastCheck || undefined } });
        const items: RosterNotification[] = res.data;
        if (items.length > 0 && !notifiedRef.current) {
          setNotifications(items);
          setShowNotifications(true);
          notifiedRef.current = true;
          // Try Capacitor local notification (available only in APK WebView)
          try {
            const cap = (window as any).Capacitor;
            if (cap?.Plugins?.LocalNotifications) {
              await cap.Plugins.LocalNotifications.schedule({
                notifications: [{
                  title: '排班更新',
                  body: `${items.length} 条排班变动，点击查看`,
                  id: 1,
                  schedule: { at: new Date(Date.now() + 1000) },
                }],
              });
            }
          } catch {
            // Capacitor not available (web browser)
          }
        }
        localStorage.setItem(NOTIFY_KEY, new Date().toISOString());
      } catch {
        // ignore polling errors
      }
    };
    pollNotifications();
  }, []);

  if (loading) {
    return <Spinner />;
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-lg mb-2">加载失败</p>
        <p className="text-sm">请检查网络后重新打开</p>
      </div>
    );
  }

  // Admin/StoreAdmin overview: show all today's rosters grouped by store
  if (isAdmin && data.overview) {
    const grouped = groupByStore(data.overview as OverviewItem[]);

    return (
      <div className="animate-fade-in space-y-4">
        {showNotifications && notifications.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 cursor-pointer" onClick={() => setShowNotifications(false)}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🔔</span>
              <span className="text-sm font-semibold text-amber-700">排班更新提醒</span>
              <span className="text-xs text-amber-500 ml-auto">点击关闭</span>
            </div>
            {notifications.slice(0, 3).map((n) => (
              <p key={n.id} className="text-xs text-amber-600 ml-7">
                {n.shiftDate} · {n.userName} · {n.startTime}-{n.endTime}
              </p>
            ))}
            {notifications.length > 3 && <p className="text-xs text-amber-500 ml-7 mt-1">...还有 {notifications.length - 3} 条</p>}
          </div>
        )}
        {announcements.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-blue-700">📢 {announcements[0].title}</span>
              <span className="text-xs text-blue-400 ml-auto">{announcements[0].createdAt.split('T')[0]}</span>
            </div>
            <p className="text-xs text-blue-600">{announcements[0].content}</p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold text-gray-800">今日排班</h1>
          {(() => {
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            let onDuty = 0;
            data.overview?.forEach((r) => {
              const [sh, sm] = r.startTime.split(':').map(Number);
              const [eh, em] = r.endTime.split(':').map(Number);
              if (nowMin >= sh * 60 + sm && nowMin < eh * 60 + em) onDuty++;
            });
            return (
              <span className="text-sm text-gray-500">
                当前在岗 <span className="text-shift-early font-bold">{onDuty}</span> 人
              </span>
            );
          })()}
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500">今日暂无排班</p>
          </div>
        ) : (
          Object.entries(grouped).map(([storeName, items]) => (
            <div key={storeName} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50/50">
                <span className="w-1.5 h-4 rounded-full bg-brand" />
                <span className="text-sm font-semibold text-gray-800">{storeName}</span>
                <span className="text-xs text-gray-400 ml-auto">{items.length} 人</span>
              </div>
              <div className="p-4 space-y-2">
                {items.map((r) => {
                  const status = getStatusLabel(r.startTime, r.endTime);
                  const colors = getShiftColor(r.startTime);
                  const [sh, sm] = r.startTime.split(':').map(Number);
                  const [eh, em] = r.endTime.split(':').map(Number);
                  const hours = (eh * 60 + em - sh * 60 - sm) / 60;
                  return (
                    <div key={r.id} className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                      <span className="text-sm font-medium text-gray-800">{r.user.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${status.color}`}>{status.text}</span>
                      <span className="text-xs text-gray-400">{hours.toFixed(1)}h</span>
                      <span className="text-sm text-gray-500 ml-auto">
                        {r.startTime} - {r.endTime}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  // Employee view: personal shift + colleagues + handover
  const { myShift, colleagues, handoverFrom, handoverTo, handoverNotes } = data;

  return (
    <div className="space-y-4 animate-fade-in">
      {showNotifications && notifications.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3" onClick={() => setShowNotifications(false)}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🔔</span>
            <span className="text-sm font-semibold text-amber-700">排班更新提醒</span>
            <span className="text-xs text-amber-500 ml-auto">点击关闭</span>
          </div>
          {notifications.slice(0, 3).map((n) => (
            <p key={n.id} className="text-xs text-amber-600 ml-7">
              {n.shiftDate} · {n.userName} · {n.startTime}-{n.endTime}
            </p>
          ))}
        </div>
      )}
      {announcements.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-blue-700">📢 {announcements[0].title}</span>
            <span className="text-xs text-blue-400 ml-auto">{announcements[0].createdAt.split('T')[0]}</span>
          </div>
          <p className="text-xs text-blue-600">{announcements[0].content}</p>
        </div>
      )}
      {myShift ? (
        <>
          <ShiftCard startTime={myShift.startTime} endTime={myShift.endTime} />

          {colleagues.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">今日同事</h2>
              <div className="flex flex-wrap gap-2">
                {colleagues.map((c) => {
                  const colors = getShiftColor(c.startTime);
                  const status = getStatusLabel(c.startTime, c.endTime);
                  return (
                    <span
                      key={c.id}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-full ${colors.card} text-xs font-medium`}
                    >
                      <span className={`w-6 h-6 rounded-full ${colors.badge} flex items-center justify-center text-xs font-semibold`}>
                        {c.name.charAt(0)}
                      </span>
                      {c.name}
                      <span className={`text-xs ml-0.5 px-1 py-0.5 rounded-full font-medium ${status.color}`}>
                        {status.text}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {(handoverFrom || handoverTo) && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">交接信息</h2>
              <div className="space-y-2">
                {handoverFrom && handoverFrom.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl bg-overlap/5 border border-overlap/10">
                    <span className="text-overlap text-xs bg-overlap/10 px-2 py-0.5 rounded-full">交班给你</span>
                    <span className="text-sm font-medium">{h.user.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{h.startTime}-{h.endTime}</span>
                  </div>
                ))}
                {handoverTo && handoverTo.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl bg-overlap/5 border border-overlap/10">
                    <span className="text-overlap text-xs bg-overlap/10 px-2 py-0.5 rounded-full">你交班给</span>
                    <span className="text-sm font-medium">{h.user.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{h.startTime}-{h.endTime}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">交接备注</h2>
              <button
                onClick={() => navigate(`/handover/${myShift.id}`)}
                className="text-xs text-brand font-medium hover:underline"
              >
                查看/添加
              </button>
            </div>
            {handoverNotes.length > 0 ? (
              <div className="space-y-2">
                {handoverNotes.slice(0, 3).map((n) => (
                  <div key={n.id} className="p-3 rounded-xl bg-surface text-sm">
                    <p className="text-gray-700">{n.content}</p>
                    <p className="text-xs text-gray-400 mt-1">{n.author.name}</p>
                  </div>
                ))}
                {handoverNotes.length > 3 && (
                  <button
                    onClick={() => navigate(`/handover/${myShift.id}`)}
                    className="text-xs text-brand w-full text-center py-1"
                  >
                    查看全部 {handoverNotes.length} 条
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">暂无交接备注</p>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500">今日暂无排班</p>
        </div>
      )}
    </div>
  );
}

function ShiftCard({ startTime, endTime }: { startTime: string; endTime: string }) {
  const colors = getShiftColor(startTime);
  const status = getStatusLabel(startTime, endTime);
  return (
    <div className={`rounded-2xl p-5 border shadow-sm ${colors.card} text-shift-early`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${colors.badge}`}>
            今日班次
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${status.color}`}>
            {status.text}
          </span>
        </div>
        <span className="text-2xl font-bold text-gray-800">
          {startTime} - {endTime}
        </span>
      </div>
    </div>
  );
}

function getShiftColor(startTime: string): { card: string; badge: string; dot: string } {
  if (startTime < '10:00') return { card: 'bg-shift-early-light border-shift-early/20', badge: 'bg-shift-early text-white', dot: 'bg-shift-early' };
  if (startTime < '14:00') return { card: 'bg-shift-mid-light border-shift-mid/20', badge: 'bg-shift-mid text-white', dot: 'bg-shift-mid' };
  return { card: 'bg-shift-late-light border-shift-late/20', badge: 'bg-shift-late text-white', dot: 'bg-shift-late' };
}

function getStatusLabel(startTime: string, endTime: string): { text: string; color: string } {
  const now = new Date();
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (nowMin >= startMin && nowMin < endMin) return { text: '在岗中', color: 'text-shift-early bg-shift-early-light' };
  if (nowMin >= startMin - 60 && nowMin < startMin) return { text: '即将上班', color: 'text-shift-mid bg-shift-mid-light' };
  if (nowMin >= endMin) return { text: '已下班', color: 'text-gray-400 bg-gray-100' };
  return { text: '今日排班', color: 'text-gray-500' };
}

type OverviewItem = { id: string; startTime: string; endTime: string; user: RosterUser; store?: { id: string; name: string }; overtimeMinutes?: number };

function groupByStore(items: OverviewItem[]): Record<string, OverviewItem[]> {
  const result: Record<string, OverviewItem[]> = {};
  for (const item of items) {
    const name = item.store?.name || '本店';
    if (!result[name]) result[name] = [];
    result[name].push(item);
  }
  return result;
}
