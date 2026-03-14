import React from 'react';
import {
  TrendingUp, DollarSign, CheckCircle,
  ThumbsUp, ArrowUpCircle, AlertTriangle, MessageSquare, Mic
} from 'lucide-react';
import { parseAIResponse } from '../utils/parseAIResponse';
import './ChatMessage.css';

/* ─── Score Ring ────────────────────────────────────────── */
function ScoreRing({ value, outOf }) {
  const pct = Math.min(100, Math.round((value / outOf) * 100));
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  const color = pct >= 75 ? 'var(--accent-3)' : pct >= 50 ? 'var(--accent-2)' : 'var(--danger)';

  return (
    <div className="score-ring-wrap">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="score-ring-label" style={{ color }}>
        <span className="score-value">{value}</span>
        <span className="score-denom">/{outOf}</span>
      </div>
    </div>
  );
}

/* ─── Structured Block Renderer ────────────────────────── */
function StructuredContent({ blocks }) {
  return (
    <div className="structured-content">
      {blocks.map((block, i) => {
        switch (block.type) {

          case 'score':
            return (
              <div key={i} className="block-score">
                <ScoreRing value={block.value} outOf={block.outOf} />
                <div className="score-meta">
                  <span className="score-title">Pitch Score</span>
                  <span className="score-sub">
                    {block.value / block.outOf >= 0.75
                      ? 'Strong performance'
                      : block.value / block.outOf >= 0.5
                        ? 'Room to improve'
                        : 'Needs work'}
                  </span>
                </div>
              </div>
            );

          case 'summary':
            return (
              <div key={i} className="block-summary">
                <p>{block.content}</p>
              </div>
            );

          case 'strengths':
            return (
              <div key={i} className="block-list strengths">
                <div className="block-list-header">
                  <ThumbsUp size={13} />
                  <span>Strengths</span>
                </div>
                <ul>
                  {block.items.map((item, j) => (
                    <li key={j}>
                      <span className="list-dot strengths-dot" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );

          case 'improvements':
            return (
              <div key={i} className="block-list improvements">
                <div className="block-list-header">
                  <ArrowUpCircle size={13} />
                  <span>Areas to Improve</span>
                </div>
                <ul>
                  {block.items.map((item, j) => (
                    <li key={j}>
                      <span className="list-dot improvements-dot" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );

          case 'critical':
            return (
              <div key={i} className="block-critical">
                <div className="critical-header">
                  <AlertTriangle size={14} />
                  <span>Critical Question</span>
                </div>
                <p className="critical-question">"{block.question}"</p>
                <div className="critical-cta">
                  <MessageSquare size={12} />
                  <span>Record your response below</span>
                </div>
              </div>
            );

          case 'question':
            return (
              <div key={i} className="block-question">
                <div className="question-header">
                  <MessageSquare size={14} />
                  <span>Question for You</span>
                </div>
                <p className="question-text">{block.question}</p>
                <div className="question-cta">
                  <Mic size={12} />
                  <span>Record your answer below</span>
                </div>
              </div>
            );

          case 'text':
          default:
            return (
              <div key={i} className="block-text">
                <p>{block.content}</p>
              </div>
            );
        }
      })}
    </div>
  );
}

/* ─── Message Type Config ───────────────────────────────── */
const TYPE_META = {
  intro:                    { label: null,                icon: null,          cls: 'intro' },
  analysis:                 { label: 'Pitch Analysis',    icon: TrendingUp,    cls: 'analysis',  structured: true },
  feedback:                 { label: 'Feedback',          icon: TrendingUp,    cls: 'feedback',  structured: true },
  question:                 { label: null,                icon: null,          cls: 'question' },
  'negotiation-prompt':     { label: 'Negotiation',       icon: DollarSign,    cls: 'negotiation-prompt' },
  'counter-offer':          { label: 'Counter Offer',     icon: DollarSign,    cls: 'counter-offer' },
  negotiation:              { label: null,                icon: null,          cls: 'negotiation' },
  'deal-closed':            { label: 'Deal Closed!',      icon: CheckCircle,   cls: 'deal-closed' },
  'deal-lost':              { label: 'Deal Lost',         icon: AlertTriangle, cls: 'deal-lost' },
  'off-context-warning':    { label: '⚠️ Stay On Topic',  icon: AlertTriangle, cls: 'off-context-warning' },
};

/* ─── Main ChatMessage ──────────────────────────────────── */
export default function ChatMessage({ msg, index }) {
  const isUser = msg.role === 'user';
  const meta = TYPE_META[msg.type] || {};
  const Icon = meta.icon;
  const useStructured = !isUser && meta.structured;

  const blocks = useStructured ? parseAIResponse(msg.content) : null;

  // Structured analysis/feedback: full-width card layout
  if (useStructured && blocks && blocks.length > 0) {
    return (
      <div
        className="chat-message assistant wide animate-fadeUp"
        style={{ animationDelay: `${index * 40}ms` }}
      >
        <div className={`msg-avatar ${meta.cls || ''}`}>
          {Icon ? <Icon size={13} /> : <span>AI</span>}
        </div>
        <div className={`msg-card ${meta.cls}`}>
          <div className="msg-card-header">
            {Icon && <Icon size={14} />}
            <span>{meta.label}</span>
          </div>
          <StructuredContent blocks={blocks} />
        </div>
      </div>
    );
  }

  // Plain bubble for user messages and simple assistant messages
  return (
    <div
      className={`chat-message ${isUser ? 'user' : 'assistant'} animate-fadeUp`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {!isUser && (
        <div className={`msg-avatar ${meta.cls || ''}`}>
          {Icon ? <Icon size={13} /> : <span>AI</span>}
        </div>
      )}
      <div className={`msg-bubble ${isUser ? 'user' : `assistant ${meta.cls || ''}`}`}>
        {!isUser && meta.label && (
          <div className="msg-label">
            {Icon && <Icon size={12} />}
            <span>{meta.label}</span>
          </div>
        )}
        <p className="msg-content">{msg.content}</p>
      </div>
      {isUser && <div className="msg-avatar user">You</div>}
    </div>
  );
}