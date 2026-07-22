import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useToast } from '../../hooks/useToast';
import ConfirmDialog from '../../components/ConfirmDialog';
import dayjs from 'dayjs';

const LEAVE_TYPES = [
  { value: 'ANNUAL', label: '年假' },
  { value: 'SICK', label: '病假' },
  { value: 'PERSONAL', label: '事假' },
];

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'PENDING', label: '待审批' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已拒绝' },
];

const STATUS_CN: Record<string, string> = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
};

interface Leave {
  id: string;
  userId: string;
  type: string;
  typeLabel: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  approverId: string | null;
  user: { id: string; name: string };
  approver: { id: string; name: string } | null;
  createdAt: string;
}

interface Employee {
  id: string;
  name: string;
}

export default function LeaveManagement() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editLeave, setEditLeave] = useState<Leave | null>(null);
  const [form, setForm] = useState({ userId: '', type: 'ANNUAL', startDate: '', endDate: '', reason: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { success, error: showError } = useToast();
  const pageSize = 20;

  const [confirm, setConfirm] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const fetchLeaves = async () => {
    try {
      const params: any = { page, pageSize };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/leaves', { params });
      setLeaves(res.data.items);
      setTotal(res.data.total);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/users/roster');
      setEmployees(res.data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchLeaves();
    fetchEmployees();
  }, [statusFilter, page]);

  const resetForm = () => {
    setForm({ userId: employees[0]?.id || '', type: 'ANNUAL', startDate: '', endDate: '', reason: '' });
    setEditLeave(null);
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (leave: Leave) => {
    setEditLeave(leave);
    setForm({
      userId: leave.userId,
      type: leave.type,
      startDate: dayjs.utc(leave.startDate).tz('Asia/Shanghai').format('YYYY-MM-DD'),
      endDate: dayjs.utc(leave.endDate).tz('Asia/Shanghai').format('YYYY-MM-DD'),
      reason: leave.reason || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (editLeave) {
        await api.put(`/leaves/${editLeave.id}`, form);
        success('请假已更新');
      } else {
        await api.post('/leaves', form);
        success('请假申请已提交');
      }
      setShowForm(false);
      resetForm();
      fetchLeaves();
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = (leave: Leave) => {
    setConfirm({
      open: true,
      title: '审批通过',
      message: `确定批准「${leave.user.name}」的${leave.typeLabel}申请吗？`,
      onConfirm: async () => {
        try {
          await api.patch(`/leaves/${leave.id}/approve`);
          success('已批准');
          fetchLeaves();
        } catch (err: any) {
          showError(err.response?.data?.error || '操作失败');
        }
        setConfirm((c) => ({ ...c, open: false }));
      },
    });
  };

  const handleReject = (leave: Leave) => {
    setConfirm({
      open: true,
      title: '审批拒绝',
      message: `确定拒绝「${leave.user.name}」的${leave.typeLabel}申请吗？`,
      onConfirm: async () => {
        try {
          await api.patch(`/leaves/${leave.id}/reject`);
          success('已拒绝');
          fetchLeaves();
        } catch (err: any) {
          showError(err.response?.data?.error || '操作失败');
        }
        setConfirm((c) => ({ ...c, open: false }));
      },
    });
  };

  const handleDelete = (leave: Leave) => {
    setConfirm({
      open: true,
      title: '删除请假',
      message: `确定删除「${leave.user.name}」的${leave.typeLabel}记录吗？`,
      onConfirm: async () => {
        try {
          await api.delete(`/leaves/${leave.id}`);
          success('已删除');
          fetchLeaves();
        } catch (err: any) {
          showError(err.response?.data?.error || '操作失败');
        }
        setConfirm((c) => ({ ...c, open: false }));
      },
    });
  };

  const formatDate = (d: string) => dayjs.utc(d).tz('Asia/Shanghai').format('M月D日');

  if (loading) return <div className="text-center text-gray-500 py-10">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">请假管理</h1>
        <button
          onClick={openCreate}
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors text-sm"
        >
          + 发起请假
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

      {/* Status tabs */}
      <div className="flex gap-2 mb-4">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => { setStatusFilter(t.value); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === t.value
                ? 'bg-brand text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Create/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setShowForm(false); resetForm(); }} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 animate-fade-in">
            <h2 className="font-semibold text-gray-800 mb-4">
              {editLeave ? '编辑请假' : '发起请假'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editLeave && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">员工</label>
                  <select
                    value={form.userId}
                    onChange={(e) => setForm({ ...form, userId: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none text-sm bg-white"
                  >
                    <option value="">请选择员工</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">请假类型</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none text-sm bg-white"
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none text-sm bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">原因（选填）</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none text-sm bg-white resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50"
                >
                  {submitting ? '提交中...' : editLeave ? '保存' : '提交'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave list */}
      <div className="bg-surface-card rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">申请人</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">类型</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">起止日期</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">原因</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">状态</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">审批人</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leaves.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-10">暂无请假记录</td>
              </tr>
            ) : (
              leaves.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3.5 text-gray-800 font-medium">{l.user.name}</td>
                  <td className="px-4 py-3.5 text-gray-500 hidden sm:table-cell">{l.typeLabel}</td>
                  <td className="px-4 py-3.5 text-gray-500 text-xs">
                    {formatDate(l.startDate)} ~ {formatDate(l.endDate)}
                  </td>
                  <td className="px-4 py-3.5 text-gray-500 hidden sm:table-cell max-w-[120px] truncate">
                    {l.reason || '-'}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                      l.status === 'APPROVED' ? 'bg-clock-in-light text-clock-in' :
                      l.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {STATUS_CN[l.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500 hidden sm:table-cell">
                    {l.approver?.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {l.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleApprove(l)}
                          className="text-clock-in hover:text-clock-in/70 text-sm"
                        >
                          通过
                        </button>
                        <button
                          onClick={() => handleReject(l)}
                          className="text-red-500 hover:text-red-600 text-sm"
                        >
                          拒绝
                        </button>
                        <button
                          onClick={() => openEdit(l)}
                          className="text-brand hover:text-brand-dark text-sm"
                        >
                          编辑
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(l)}
                      className="text-gray-400 hover:text-gray-600 text-sm"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>共 {total} 条</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
            >
              上一页
            </button>
            <button
              disabled={page * pageSize >= total}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
      />
    </div>
  );
}
