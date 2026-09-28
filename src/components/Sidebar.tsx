import React from 'react';
import { Conversation } from '../types';
import { Plus, MessageSquare, Trash2, Search } from 'lucide-react';

interface SidebarProps {
  conversations: Conversation[];
  activeConvId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConvId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-80 bg-surface border-r border-subtle flex flex-col h-[calc(100vh-65px)]">
      {/* New Chat Button */}
      <div className="p-4 border-b border-subtle">
        <button
          onClick={onNewConversation}
          className="w-full py-2.5 px-4 rounded-xl btn-primary text-xs font-semibold flex items-center justify-center space-x-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="px-4 py-3 border-b border-subtle bg-slate-50/50">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted" />
          <input
            type="text"
            placeholder="Search queries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full saas-input pl-9 pr-3 py-1.5 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-muted text-xs">
            {searchTerm ? 'No matching conversations' : 'No previous conversations'}
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = conv.id === activeConvId;
            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer text-xs transition-all ${
                  isActive
                    ? 'bg-indigo-50 border border-indigo-200 text-primary font-semibold shadow-sm'
                    : 'hover:bg-slate-50 border border-transparent text-body hover:text-heading'
                }`}
              >
                <div className="flex items-center space-x-2.5 overflow-hidden">
                  <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted'}`} />
                  <div className="truncate text-left">
                    <div className="truncate">{conv.title}</div>
                    <div className="text-[10px] text-muted truncate mt-0.5 font-normal">
                      {new Date(conv.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                  }}
                  title="Delete Chat"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
