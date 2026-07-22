import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useToast } from '../hooks/useToast';
import Spinner from '../components/Spinner';
import { ChevronLeft } from '../components/Icon';

interface Note {
  id: string;
  content: string;
  author: { id: string; name: string };
  createdAt: string;
}

export default function NotePage() {
  const { rosterId } = useParams<{ rosterId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchNotes = () => {
    api
      .get(`/handover/${rosterId}`)
      .then((res) => setNotes(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotes();
  }, [rosterId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      await api.post('/handover', { rosterId, content: content.trim() });
      setContent('');
      showToast('已发送', 'success');
      fetchNotes();
    } catch (err: any) {
      showToast(err.response?.data?.error || '发送失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-4">
      {/* Back Button */}
      <button
        onClick={() => navigate('/today')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft className="w-4 h-4" />
        返回
      </button>

      {/* Note Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="输入交接备注..."
          rows={3}
          maxLength={500}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">{content.length}/500</span>
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="bg-brand text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-50 active:scale-[0.98]"
          >
            {submitting ? '发送中...' : '发送'}
          </button>
        </div>
      </form>

      {/* Notes List */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          交接备注 ({notes.length})
        </h2>
        {loading ? (
          <Spinner size="sm" />
        ) : notes.length > 0 ? (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-700">{n.content}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">{n.author.name}</span>
                  <span className="text-xs text-gray-300">
                    {new Date(n.createdAt).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">暂无备注</p>
        )}
      </div>
    </div>
  );
}
