'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect } from 'react';
import { TeamConfig } from '@/lib/teams';

interface ChatInterfaceProps {
  team: TeamConfig;
}

const colorMap: Record<string, string> = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  orange: 'bg-orange-500',
  purple: 'bg-purple-600',
};

const borderMap: Record<string, string> = {
  blue: 'border-blue-600 focus:ring-blue-500',
  green: 'border-green-600 focus:ring-green-500',
  orange: 'border-orange-500 focus:ring-orange-400',
  purple: 'border-purple-600 focus:ring-purple-500',
};

export function ChatInterface({ team }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { teamId: team.id },
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    await sendMessage({ text });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const accentColor = colorMap[team.color] ?? 'bg-gray-600';
  const inputBorder = borderMap[team.color] ?? 'border-gray-400 focus:ring-gray-400';

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className={`${accentColor} text-white px-6 py-4 shadow-md`}>
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <a href="/" className="text-white/70 hover:text-white text-sm transition-colors">
            ← 팀 선택
          </a>
          <span className="text-white/40">|</span>
          <span className="text-xl">{team.emoji}</span>
          <div>
            <h1 className="font-bold text-lg leading-tight">{team.name} AI 어시스턴트</h1>
            <p className="text-white/70 text-xs">{team.description}</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-4">{team.emoji}</div>
              <p className="text-lg font-medium text-gray-500">
                {team.name} AI 어시스턴트입니다
              </p>
              <p className="text-sm mt-1">{team.description}에 대해 질문해보세요.</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div
                  className={`${accentColor} w-8 h-8 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0 mt-1`}
                >
                  {team.emoji}
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  message.role === 'user'
                    ? 'bg-gray-800 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
                }`}
              >
                {message.parts.map((part, i) =>
                  part.type === 'text' ? (
                    <span key={i}>{part.text}</span>
                  ) : null
                )}
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm flex-shrink-0 mt-1">
                  나
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div
                className={`${accentColor} w-8 h-8 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0`}
              >
                {team.emoji}
              </div>
              <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
                <div className="flex gap-1 items-center h-5">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center text-red-500 text-sm py-2">
              오류가 발생했습니다. API 키를 확인해 주세요.
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-gray-200 bg-white px-4 py-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
            rows={1}
            className={`flex-1 resize-none rounded-xl border-2 ${inputBorder} px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-offset-1 transition-all max-h-40 overflow-y-auto`}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={`${accentColor} text-white px-5 py-3 rounded-xl font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex-shrink-0`}
          >
            전송
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-2">
          AI 답변은 참고용입니다. 중요한 사안은 담당자에게 확인하세요.
        </p>
      </footer>
    </div>
  );
}
