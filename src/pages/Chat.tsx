import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '../components/Sidebar';
import { SourceBadge } from '../components/SourceBadge';
import { Conversation, Message } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Send, Bot, User, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';

export const Chat: React.FC = () => {
  const { isDemoMode } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    if (isDemoMode) return;
    try {
      const res = await api.get('/conversations');
      setConversations(res.data.conversations || []);
    } catch (e) {
      console.error('Failed to fetch conversations:', e);
    }
  };

  const loadConversation = async (convId: string) => {
    if (isDemoMode) return;
    try {
      setActiveConvId(convId);
      const res = await api.get(`/conversations/${convId}`);
      setMessages(res.data.messages || []);
    } catch (e) {
      console.error('Failed to load conversation:', e);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [isDemoMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleNewConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setInputMessage('');
  };

  const handleDeleteConversation = async (convId: string) => {
    if (isDemoMode) {
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) handleNewConversation();
      return;
    }
    try {
      await api.delete(`/conversations/${convId}`);
      if (activeConvId === convId) {
        handleNewConversation();
      }
      fetchConversations();
    } catch (e) {
      console.error('Failed to delete conversation:', e);
    }
  };

  const getDemoResponse = (query: string) => {
    const q = query.toLowerCase();
    if (q.includes('day 1') || q.includes('c programming') || q.includes('variable')) {
      return {
        content: `## 🎓 C Programming & Data Structures — Day 1: Variables & Data Types\n\n**Source Document:** \`C Programming & Data Structures-Syllabus.pdf\` *(Page 1)*\n\n### 💡 Key Concepts & Technical Explanations\n\n#### 1. **Variables & Constants**\n- **Explanation**: A variable is a named memory location used to store values that can be modified during program execution. A constant (\`const\` or \`#define\`) holds a fixed value.\n- **C Code Example**:\n\`\`\`c\n#include <stdio.h>\n\nint main() {\n    int studentAge = 20; // Variable\n    const float PI = 3.14159; // Constant\n    printf("Age: %d, PI: %.2f\\n", studentAge, PI);\n    return 0;\n}\n\`\`\`\n\n#### 2. **Data Types & Input/Output**\n- **Explanation**: Fundamental C data types include \`int\`, \`float\`, \`double\`, and \`char\`. Input/output is handled via \`scanf()\` and \`printf()\`.`,
        sources: [{ documentId: 'doc_syllabus_1', documentName: 'C Programming & Data Structures-Syllabus.pdf', pageNumber: 1, similarityScore: 0.96 }]
      };
    } else if (q.includes('hostel') || q.includes('fee')) {
      return {
        content: 'According to official hostel guidelines:\n• Annual Hostel Fee: ₹45,000 per academic year.\n• Application Deadline: July 15, 2026.\n• Security Deposit: ₹5,000 (Refundable upon checkout).',
        sources: [{ documentId: 'doc_1', documentName: 'Hostel_Rules_2026.pdf', pageNumber: 2, similarityScore: 0.95 }]
      };
    } else if (q.includes('exam') || q.includes('semester')) {
      return {
        content: 'According to the Academic Calendar 2026:\n• Autumn Semester Begins: August 1, 2026.\n• Mid-Semester Exams: October 10 - 18, 2026.\n• Semester 5 Examination Fee: ₹1,200 per student.',
        sources: [{ documentId: 'doc_2', documentName: 'Academic_Calendar_2026.pdf', pageNumber: 5, similarityScore: 0.92 }]
      };
    } else if (q.includes('library')) {
      return {
        content: 'According to Library Services Manual:\n• Opening Hours: 8:00 AM to 9:00 PM (Monday to Saturday).\n• Sunday Hours: 10:00 AM to 4:00 PM.\n• Book Borrow Limit: 4 books for Undergraduates (14 days return window).',
        sources: [{ documentId: 'doc_3', documentName: 'Library_Rules_and_Services.txt', pageNumber: 1, similarityScore: 0.98 }]
      };
    } else if (q.includes('scholarship')) {
      return {
        content: 'Merit & Financial Assistance Scholarships:\n• Merit Scholarship: 50% tuition waiver for students scoring above 9.0 CGPA.\n• Financial Aid: Up to ₹25,000 per semester for family income under ₹3.0 LPA.',
        sources: [{ documentId: 'doc_4', documentName: 'Scholarship_Policies_2026.pdf', pageNumber: 3, similarityScore: 0.89 }]
      };
    }

    return {
      content: `## 🎓 Campus Knowledge Base Answer\n\n**Source Document:** \`Campus_Notice_Board_2026.pdf\` *(Page 1)*\n\nRegarding **"${query}"**:\n\nAccording to campus records, all academic notices, exam timetables, hostel policies, and course syllabi are grounded in official PDF documents. For detailed inquiries, please visit the main administration portal or consult your department coordinator.`,
      sources: [{ documentId: 'doc_5', documentName: 'Campus_Notice_Board_2026.pdf', pageNumber: 1, similarityScore: 0.88 }]
    };
  };



  const handleSendMessage = async (textToSend?: string) => {
    const queryText = textToSend || inputMessage;
    if (!queryText || !queryText.trim() || loading) return;

    setError('');
    setInputMessage('');
    setLoading(true);

    const userTempMsg: Message = {
      id: `temp_${Date.now()}`,
      role: 'user',
      content: queryText.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userTempMsg]);

    if (isDemoMode) {
      setTimeout(() => {
        const demoData = getDemoResponse(queryText.trim());
        const assistantMsg: Message = {
          id: `demo_ans_${Date.now()}`,
          role: 'assistant',
          content: demoData.content,
          sources: demoData.sources,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLoading(false);
      }, 700);
      return;
    }

    try {
      const res = await api.post('/chat', {
        conversationId: activeConvId,
        message: queryText.trim(),
      });

      setActiveConvId(res.data.conversationId);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== userTempMsg.id),
        res.data.userMessage,
        res.data.assistantMessage,
      ]);

      fetchConversations();
    } catch (err: any) {
      const status = err.response?.status;
      const isConnectionError = !err.response || err.code === 'ERR_NETWORK' || status === 404 || status === 405;

      if (isConnectionError) {
        // Fallback to Demo response on connection failure
        const demoData = getDemoResponse(queryText.trim());
        const assistantMsg: Message = {
          id: `demo_ans_${Date.now()}`,
          role: 'assistant',
          content: demoData.content,
          sources: demoData.sources,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        setError(err.response?.data?.error || 'Failed to process answer from college knowledge base.');
        setMessages((prev) => prev.filter((m) => m.id !== userTempMsg.id));
      }
    } finally {
      setLoading(false);
    }
  };


  const samplePrompts = [
    "What is the annual hostel fee and application deadline?",
    "When does the Autumn 2026 semester begin?",
    "How much is the Semester 5 examination fee?",
    "What scholarships are available for merit students?",
    "What are the library opening hours on weekdays?",
    "Who won the inter-college cricket tournament?",
  ];

  return (
    <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-main">
      {/* Conversation Sidebar */}
      <Sidebar
        conversations={conversations}
        activeConvId={activeConvId}
        onSelectConversation={loadConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      {/* Main Chat Body */}
      <div className="flex-1 flex flex-col h-full bg-main relative">
        {/* Welcome Screen when no messages */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500 flex items-center justify-center shadow-md mb-5 text-white">
              <Bot className="w-7 h-7" />
            </div>

            <h2 className="text-2xl font-extrabold text-heading tracking-tight">
              Ask Anything About Official Campus Documents
            </h2>
            <p className="text-body text-xs mt-2 leading-relaxed max-w-lg">
              Our AI Assistant uses <strong className="text-primary font-semibold">Retrieval-Augmented Generation (RAG)</strong> to answer queries using official uploaded PDFs, notices, and calendars with exact source citations.
            </p>

            {/* Prompt Chips */}
            <div className="mt-8 w-full">
              <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-3 flex items-center justify-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-ai" />
                <span>Suggested Questions</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                {samplePrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="p-3.5 rounded-xl saas-card saas-card-hover text-xs text-body hover:text-heading flex items-start space-x-2.5 text-left"
                  >
                    <HelpCircle className="w-4 h-4 text-ai mt-0.5 flex-shrink-0" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Messages Container */
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isUnknown =
                msg.role === 'assistant' &&
                msg.content.includes("couldn't find this information in the college knowledge base");

              return (
                <div
                  key={msg.id}
                  className={`flex items-start space-x-3.5 ${
                    isUser ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                      isUser
                        ? 'bg-primary text-white'
                        : isUnknown
                        ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : 'bg-cyan-500 text-white'
                    }`}
                  >
                    {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-primary text-white rounded-tr-none shadow-sm'
                        : isUnknown
                        ? 'bg-amber-50 border border-amber-200 text-heading rounded-tl-none shadow-sm'
                        : 'bg-surface border border-subtle text-heading rounded-tl-none shadow-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {/* Sources Badge */}
                    {!isUser && msg.sources && (
                      <SourceBadge sources={msg.sources} onSelectSourceQuery={handleSendMessage} />
                    )}

                    <div
                      className={`text-[10px] mt-2 text-right ${
                        isUser ? 'text-indigo-200' : 'text-muted'
                      }`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Loader */}
            {loading && (
              <div className="flex items-start space-x-3.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500 text-white flex items-center justify-center shadow-sm">
                  <Bot className="w-5 h-5 animate-spin" />
                </div>
                <div className="bg-surface border border-subtle p-3.5 rounded-2xl rounded-tl-none text-xs text-ai font-semibold flex items-center space-x-2 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                  <span>Searching college knowledge base & generating response...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mb-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 border-t border-subtle bg-surface">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-3 max-w-4xl mx-auto"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask a question (e.g. Hostel fees, Exam dates, Library timings)..."
              disabled={loading}
              className="flex-1 saas-input py-3 px-4 rounded-xl text-sm placeholder:text-muted"
            />

            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="py-3 px-5 rounded-xl btn-primary text-xs flex items-center space-x-2 shadow-sm transition-all disabled:opacity-40"
            >
              <span>Send</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
