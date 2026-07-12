import React, { useState, useRef, useEffect } from 'react';
import { Send, User as UserIcon } from 'lucide-react';
import { Task, ChatMessage, SiengeTitle } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

interface TaskChatProps {
  task?: Task;
  siengeTitle?: SiengeTitle;
  onUpdate: (chatMessages: ChatMessage[]) => void;
  baseColor?: string;
  theme?: any;
  readOnly?: boolean;
  hideHeader?: boolean;
  customTitle?: string;
}

export default function TaskChat({ task, siengeTitle, onUpdate, baseColor = 'blue', theme, readOnly = false, hideHeader = false, customTitle }: TaskChatProps) {
  const [text, setText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const { currentUser, allUsers } = useAuth();
  const { addNotification } = useNotifications();

  const chatMessages = task?.chatMessages || siengeTitle?.chatMessages || [];

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = '32px';
      if (text) {
        const scrollHeight = inputRef.current.scrollHeight;
        inputRef.current.style.height = `${Math.min(scrollHeight, 100)}px`;
      }
    }
  }, [text]);

  const filteredUsers = allUsers.filter(u => 
    u.name.toLowerCase().includes(mentionQuery.toLowerCase()) && u.id !== currentUser?.id
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Detect mention trigger
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPosition);
    
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_ ]*)$/);
    if (match) {
      setShowMentions(true);
      setMentionQuery(match[1]);
    } else {
      setShowMentions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => Math.min(prev + 1, filteredUsers.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selectedIndex = Math.max(0, mentionIndex);
        handleMentionSelect(filteredUsers[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMentionSelect = (user: any) => {
    const cursorPosition = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const textAfterCursor = text.substring(cursorPosition);
    
    // Replace the @query part with the user's name
    const lastAtPos = textBeforeCursor.lastIndexOf('@');
    const newTextBefore = textBeforeCursor.substring(0, lastAtPos);
    
    const newText = `${newTextBefore}@${user.name} ${textAfterCursor}`;
    setText(newText);
    setShowMentions(false);
    setMentionQuery('');
    setMentionIndex(-1);
    
    // Focus back and adjust cursor
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        const newCursorPos = lastAtPos + user.name.length + 2;
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  const handleSend = () => {
    if (!text.trim() || !currentUser) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      text: text.trim(),
      timestamp: new Date().toISOString()
    };

    const newMessages = [...chatMessages, newMessage];
    onUpdate(newMessages);

    // Parse text to find mentions and send notifications
    allUsers.forEach(user => {
      if (user.id !== currentUser.id && text.includes(`@${user.name}`)) {
        if (task) {
          addNotification({
            userId: user.id,
            actorId: currentUser.id,
            taskId: task.id,
            type: 'chat_mention',
            message: `${currentUser.name} marcou você no chat da tarefa: ${task.title}`,
            targetId: `task-chat-${task.id}`
          });
        } else if (siengeTitle) {
          addNotification({
            userId: user.id,
            actorId: currentUser.id,
            siengeTitleId: siengeTitle.id,
            type: 'chat_mention',
            message: `${currentUser.name} marcou você no chat do título: ${siengeTitle.titulo}`,
            targetId: `sienge-chat-${siengeTitle.id}`
          });
        }
      }
    });

    setText('');
    setShowMentions(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#121214] border border-zinc-800/40 rounded-lg overflow-hidden font-sans">
      {!hideHeader && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-zinc-900 bg-[#08080a]">
          {!customTitle && <MessageSquareIcon size={10} className={theme ? theme.text : "text-zinc-500"} opacity={0.7} />}
          <h3 className={`text-[9px] font-medium uppercase tracking-wider opacity-70 ${theme ? theme.text : "text-zinc-500"}`}>{customTitle || 'Chat'}</h3>
        </div>
      )}

      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0"
      >
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600">
            <MessageSquareIcon size={24} className="opacity-20 mb-2" />
            <p className="text-[11px] text-center">Nenhuma mensagem ainda.</p>
          </div>
        ) : (
          chatMessages.map((msg, index) => {
            const sender = allUsers.find(u => u.id === msg.senderId);
            const prevMsg = index > 0 ? chatMessages[index - 1] : null;
            const isSameSender = prevMsg && prevMsg.senderId === msg.senderId;
            // Check if messages are close in time (e.g., less than 5 minutes apart)
            const isCloseInTime = prevMsg && (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime()) < 5 * 60 * 1000;
            const groupMessages = isSameSender && isCloseInTime;
            
            return (
              <div key={msg.id} className={`flex gap-3 w-full ${groupMessages ? 'mt-0' : 'mt-2'}`}>
                {/* Avatar area */}
                <div className="flex-shrink-0 w-6 flex flex-col items-center">
                  {!groupMessages ? (
                    sender?.avatarUrl ? (
                      <img src={sender.avatarUrl} alt={sender.name} className="w-6 h-6 rounded-full object-cover shadow-sm" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-300 shadow-sm border border-zinc-700/50">
                        {sender?.initials || 'US'}
                      </div>
                    )
                  ) : (
                    <span className="text-[9px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                
                {/* Message Content */}
                <div className="flex flex-col min-w-0 flex-1">
                  {!groupMessages && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-zinc-200">
                        {sender?.name || 'Usuário Desconhecido'}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                  <p className="text-[13px] text-zinc-300 whitespace-pre-wrap break-words leading-relaxed">
                    {(() => {
                      if (!allUsers || allUsers.length === 0) return msg.text;
                      const names = allUsers.map(u => u.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                      const regex = new RegExp(`(@(?:${names.join('|')}))`, 'g');
                      return msg.text.split(regex).map((part, i) => {
                        if (part.startsWith('@') && allUsers.some(u => `@${u.name}` === part)) {
                          return <span key={i} className={`font-semibold ${theme ? theme.text : 'text-blue-400'}`}>{part}</span>;
                        }
                        return <React.Fragment key={i}>{part}</React.Fragment>;
                      });
                    })()}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!readOnly && (
        <div className="relative p-3 bg-zinc-900/10 border-t border-zinc-800/40">
          {showMentions && filteredUsers.length > 0 && (
            <div className="absolute bottom-full left-3 mb-2 w-64 max-h-48 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-10 flex flex-col p-1 animate-fade-in">
              {filteredUsers.map((u, i) => (
                <button
                  key={u.id}
                  onClick={() => handleMentionSelect(u)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs rounded transition-colors text-left ${
                    i === mentionIndex || (mentionIndex === -1 && i === 0)
                      ? `bg-zinc-800 ${theme ? theme.text : 'text-blue-300'}` 
                      : 'text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0">
                    {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" /> : u.initials}
                  </div>
                  <span className="truncate">{u.name}</span>
                </button>
              ))}
            </div>
          )}
          
          <div className="flex items-end gap-2 relative">
            <textarea
              ref={inputRef}
              value={text}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Responder... (@ para marcar)"
              className="flex-1 bg-transparent border-0 px-1 py-1.5 text-[13px] text-zinc-200 placeholder-zinc-600 focus:outline-none resize-none transition-colors"
              rows={1}
              style={{
                height: '32px',
                maxHeight: '100px',
                overflowY: text && inputRef.current && inputRef.current.scrollHeight > 100 ? 'auto' : 'hidden'
              }}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className={`flex-shrink-0 p-1.5 mb-0.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                text.trim() 
                  ? (theme ? `${theme.text} hover:bg-zinc-800` : 'text-blue-500 hover:bg-blue-500/10')
                  : 'text-zinc-600'
              }`}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageSquareIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
