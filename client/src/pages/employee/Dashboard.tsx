import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';

export default function EmployeeDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">
        欢迎，{user?.name}
      </h1>

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
