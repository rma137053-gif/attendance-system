import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../../api/client';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  createdAt: string;
}

const TYPE_STYLE: Record<string, string> = {
  ROSTER: 'bg-blue-100 text-blue-600',
  HOLIDAY: 'bg-red-100 text-red-600',
  GENERAL: 'bg-gray-100 text-gray-600',
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/announcements', { params: { page: 1, pageSize: 3 } })
      .then((res) => setAnnouncements(res.data.items))
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">
        欢迎，{user?.name}
      </h1>

      {announcements.length > 0 && (
        <div className="mb-6 space-y-2">
          {announcements.map((a) => (
            <div
              key={a.id}
              onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
              className="bg-white rounded-xl border border-gray-200 p-3 cursor-pointer hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${TYPE_STYLE[a.type] || TYPE_STYLE.GENERAL}`}>
                  {a.type === 'ROSTER' ? '排班' : a.type === 'HOLIDAY' ? '假期' : '通知'}
                </span>
                <span className="text-sm font-medium text-gray-800 truncate flex-1">{a.title}</span>
                <span className="text-xs text-gray-400">{a.createdAt.split('T')[0]}</span>
              </div>
              {expandedId === a.id && (
                <p className="text-sm text-gray-600 mt-2 pl-1">{a.content}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/dashboard/clock"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="text-3xl mb-2">📸</div>
          <h2 className="text-lg font-semibold text-gray-800">我要打卡</h2>
          <p className="text-sm text-gray-500 mt-1">上班或下班打卡（需拍照）</p>
        </Link>

        <Link
          to="/dashboard/records"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="text-3xl mb-2">📋</div>
          <h2 className="text-lg font-semibold text-gray-800">我的记录</h2>
          <p className="text-sm text-gray-500 mt-1">查看历史打卡记录与照片</p>
        </Link>
      </div>
    </div>
  );
}
