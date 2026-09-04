'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import type { SalonCatalog } from '@/lib/catalog';
import {
  generateLocalBotResponse,
  parseChatFormatting,
  type ChatAction,
  type ChatMessage,
  type FormattedTextToken,
} from '@/lib/chat-assistant';

export type ChatAssistantProps = {
  catalog: SalonCatalog;
  summary: string[];
  total: number;
  onNavigateToBooking?: () => void;
  onNavigateToGallery?: () => void;
  onNavigateToCalculator?: () => void;
  onStartTour?: () => void;
};

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    '¡Hola! Soy tu asistente de Valentina Nails by Priscila. Puedo orientarte con técnicas, decoraciones, precios en Soles y reservas.',
};

export function ChatAssistant({
  catalog,
  summary,
  total,
  onNavigateToBooking,
  onNavigateToGallery,
  onNavigateToCalculator,
  onStartTour,
}: ChatAssistantProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [suggestions, setSuggestions] = useState<string[]>([
    '¿Qué técnica me conviene?',
    '¿Cuáles son los horarios?',
    '¿Cuál es mi precio?',
  ]);
  const [hasInteracted, setHasInteracted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatApiUrl = import.meta.env.VITE_CHAT_API_URL as string | undefined;

  // Auto-scroll al final cuando hay nuevos mensajes o cambia estado de envío
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending, open]);

  // Foco en el input al abrir y listener para tecla Escape
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open]);

  const handleAction = (action: ChatAction) => {
    if (action.type === 'whatsapp' && action.url) {
      window.open(action.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (action.type === 'booking') {
      setOpen(false);
      onNavigateToBooking?.();
      return;
    }
    if (action.type === 'gallery') {
      setOpen(false);
      onNavigateToGallery?.();
      return;
    }
    if (action.type === 'calculator') {
      setOpen(false);
      onNavigateToCalculator?.();
      return;
    }
    if (action.type === 'tour') {
      setOpen(false);
      onStartTour?.();
      return;
    }
  };

  const resetChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setSuggestions([
      '¿Qué técnica me conviene?',
      '¿Cuáles son los horarios?',
      '¿Cuál es mi precio?',
    ]);
  };

  const send = async (preset?: string) => {
    const question = (preset ?? text).trim();
    if (!question || sending) return;

    setHasInteracted(true);
    const userMessage: ChatMessage = { role: 'user', content: question, timestamp: Date.now() };
    const nextMessages: ChatMessage[] = [...messages, userMessage];
    setMessages(nextMessages);
    setText('');
    setSending(true);

    const localResult = generateLocalBotResponse({
      question,
      catalog,
      summary,
      total,
    });

    try {
      if (!chatApiUrl) {
        await new Promise((resolve) => window.setTimeout(resolve, 320));
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content: localResult.answer,
            action: localResult.action,
            timestamp: Date.now(),
          },
        ]);
        setSuggestions(localResult.suggestions);
        return;
      }

      const response = await fetch(chatApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          context: {
            selection: summary,
            estimatedPrice: total,
            currency: 'PEN',
          },
        }),
      });

      if (!response.ok) throw new Error('El asistente no está disponible en este momento.');
      const data = (await response.json()) as { answer?: string };
      const answer = data.answer?.trim() || localResult.answer;

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: answer,
          action: localResult.action,
          timestamp: Date.now(),
        },
      ]);
      setSuggestions(localResult.suggestions);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: `${localResult.answer}\n\nSi deseas una atención 100% personalizada, escríbele directo a Priscila por WhatsApp.`,
          action: localResult.action || {
            type: 'whatsapp',
            label: '💬 Escribir por WhatsApp',
            url: `https://wa.me/${catalog.whatsapp}?text=${encodeURIComponent(
              `Hola Priscila, tengo una duda sobre mi set: "${question}"`,
            )}`,
          },
          timestamp: Date.now(),
        },
      ]);
      setSuggestions(localResult.suggestions);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`chat-assistant ${open ? 'open' : ''}`}>
      {open && (
        <dialog
          id="chat-panel"
          className="chat-panel"
          open
          aria-label="Asistente de Valentina Nails"
        >
          <header>
            <span className="chat-avatar-badge" aria-hidden="true">
              V
            </span>
            <div className="chat-header-info">
              <strong>Valentina Nails Atelier</strong>
              <small>
                <i /> En línea · Asesoría en Soles
              </small>
            </div>
            <div className="chat-header-actions">
              <button
                type="button"
                onClick={resetChat}
                title="Reiniciar conversación"
                aria-label="Reiniciar conversación"
                className="chat-reset-btn"
              >
                <RotateCcw />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar chat"
                className="chat-close-btn"
              >
                <X />
              </button>
            </div>
          </header>

          <div className="chat-messages" aria-live="polite">
            {messages.map((message, index) => {
              const tokens = parseChatFormatting(message.content);
              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`chat-bubble-wrapper ${message.role}`}
                >
                  <div className={`chat-bubble ${message.role}`}>
                    <div className="chat-bubble-text">
                      {tokens.map((token: FormattedTextToken, tIndex: number) => {
                        if (token.isLineBreak) {
                          return <br key={tIndex} />;
                        }
                        if (token.isBold) {
                          return (
                            <strong key={tIndex} className="chat-bold">
                              {token.text}
                            </strong>
                          );
                        }
                        return <span key={tIndex}>{token.text}</span>;
                      })}
                    </div>
                    {message.action && (
                      <button
                        type="button"
                        className="chat-action-btn"
                        onClick={() => handleAction(message.action!)}
                      >
                        <span>{message.action.label}</span>
                        {message.action.type === 'whatsapp' ? (
                          <ExternalLink className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="chat-bubble-wrapper assistant">
                <div className="chat-bubble assistant typing">
                  <span className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </span>
                  <small>Escribiendo respuesta…</small>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {suggestions.length > 0 && !sending && (
            <div className="chat-prompts" aria-label="Preguntas sugeridas">
              {suggestions.map((prompt) => (
                <button
                  type="button"
                  key={prompt}
                  onClick={() => void send(prompt)}
                  className="chat-prompt-pill"
                >
                  <Sparkles className="chat-prompt-icon" />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <input
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={600}
              placeholder="Escribe tu pregunta sobre técnicas, precios…"
              aria-label="Mensaje para el asistente"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              aria-label="Enviar mensaje"
            >
              <Send />
            </button>
          </form>
        </dialog>
      )}

      <button
        className={`chat-launcher ${open ? 'is-open' : ''} ${!hasInteracted && !open ? 'pulse-launcher' : ''}`}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="chat-panel"
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente virtual'}
      >
        <span className="chat-launcher-icon">
          {open ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        </span>
        {!hasInteracted && !open && <span className="chat-launcher-badge" />}
      </button>
    </div>
  );
}
