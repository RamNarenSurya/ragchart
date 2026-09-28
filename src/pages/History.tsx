import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Conversation } from '../types';
import { MessageSquare, Calendar, Trash2, ArrowRight } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/conversations');
      setConversations(res.data.conversations || []);
    } catch (e) {
      console.error('Failed to fetch conversation history:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/conversations/${id}`);
      fetchHistory();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 bg-main min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-heading flex items-center space-x-2.5">
            <MessageSquare className="w-6 h-6 text-primary" />
            <span>Chat History</span>
          </h1>
          <p className="text-body text-xs mt-1">Review your past college information queries.</p>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-muted text-xs">Loading conversations...</div>
        ) : conversations.length === 0 ? (
          <div className="saas-card p-8 text-center text-muted text-xs">
            No chat history found. Start a new conversation!
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => navigate('/chat')}
              className="saas-card saas-card-hover p-4 rounded-xl flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-primary flex items-center justify-center border border-indigo-100">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-heading text-sm group-hover:text-primary transition-colors">
                    {conv.title}
                  </div>
                  <div className="text-xs text-body mt-0.5 line-clamp-1">
                    {conv.lastMessage || 'No messages'}
                  </div>
                  <div className="flex items-center space-x-1.5 text-[10px] text-muted mt-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(conv.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={(e) => handleDelete(conv.id, e)}
                  title="Delete Conversation"
                  className="p-1.5 rounded-lg bg-surface hover:bg-red-50 text-muted hover:text-red-600 border border-subtle hover:border-red-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ArrowRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
