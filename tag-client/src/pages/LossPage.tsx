import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useToast } from '../hooks/useToast';

export default function LossPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || Number(quantity) <= 0) { showToast('请输入有效数量', 'error'); return; }
    setSubmitting(true);
    try {
      await api.post('/transactions/loss', { quantity: Number(quantity), note });
      showToast(`报损 ${quantity} 张成功`, 'success');
      navigate('/');
    } catch (err: any) {
      showToast(err.response?.data?.error || '操作失败', 'error');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-base font-bold text-gray-800 mb-4">🗑️ 吊牌报损</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
        <div>
          <label className="block text-sm text-gray-500 mb-1">数量（张）</label>
          <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)}
            placeholder="如：10" required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg outline-none focus:ring-2 focus:ring-brand/20" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">原因（选填）</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="如：印刷瑕疵"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand/20" />
        </div>
        <button type="submit" disabled={submitting}
          className="w-full py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 disabled:opacity-50">
          {submitting ? '提交中...' : '确认报损'}
        </button>
      </form>
    </div>
  );
}
