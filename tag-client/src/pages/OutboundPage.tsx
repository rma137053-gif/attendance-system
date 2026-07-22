import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api/client';
import { useToast } from '../hooks/useToast';

export default function OutboundPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [employeeName, setEmployeeName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || Number(quantity) <= 0) { showToast('请输入有效数量', 'error'); return; }
    if (!employeeName.trim()) { showToast('请填写员工姓名', 'error'); return; }
    setSubmitting(true);
    try {
      await api.post('/transactions/out', { quantity: Number(quantity), employeeName: employeeName.trim(), date, note });
      showToast(`每日使用 ${quantity} 张已记录`, 'success');
      navigate('/');
    } catch (err: any) {
      showToast(err.response?.data?.error || '操作失败', 'error');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-base font-bold text-gray-800 mb-4">📅 每日使用</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
        <div>
          <label className="block text-sm text-gray-500 mb-1">日期</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand/20" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">员工姓名</label>
          <input type="text" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)}
            placeholder="输入员工姓名" required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand/20" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">使用数量（张）</label>
          <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)}
            placeholder="如：50" required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg outline-none focus:ring-2 focus:ring-brand/20" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">备注（选填）</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="如：补发上月"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand/20" />
        </div>
        <button type="submit" disabled={submitting}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
          {submitting ? '提交中...' : '确认记录'}
        </button>
      </form>
    </div>
  );
}
