import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, RotateCcw, Send, DollarSign, BarChart2, X, Smile } from 'lucide-react';
import ChatMessage from '../components/ChatMessage';
import ScoresPanel from '../components/ScoresPanel';
import CustomerMoodPanel from '../components/CustomerMoodPanel';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { extractDimensionScores } from '../utils/Extractdimensionscores';
import './PracticePage.css';

const API = import.meta.env.VITE_BACKEND_URL;

const EMPTY_SCORES = {
  tone: null,
  communication: null,
  content: null,
  queryHandling: null,
  closure: null,
};

const OFF_CONTEXT_LIMIT = 3;

const OFF_CONTEXT_SIGNALS = [
  /not relevant/i, /out of context/i, /off.?topic/i, /doesn'?t address/i,
  /did not answer/i, /failed to address/i, /not related/i, /unrelated/i,
  /missed the (point|question)/i, /doesn'?t answer/i, /avoid(ed|ing) the question/i,
  /not answer(ing|ed) my question/i, /that('?s| is) not what I asked/i,
  /please (stay|keep it) (on topic|relevant|focused)/i, /irrelevant/i,
];

const RUDE_PATTERNS = [
  /can (you |please )?(leave|go|stop|exit)/i,       // "can you leave", "can you go", etc.
  /please (leave|go away|stop)/i,
  /you can leave/i,
  /get out/i,
  /go away/i,
  /not here to help/i,
  /i don'?t care/i,
  /leave me alone/i,
  /stop (talking|bothering|calling)/i,
  /shut up/i,
  /waste of (my )?time/i,
  /i hate (you|this|your)/i,
  /you'?re (useless|terrible|awful|horrible|pathetic|ridiculous)/i,
  /never (buy|purchase|use)/i,
  /hang(ing)? up/i,
  /goodbye forever/i,
  /do not (call|contact) (me|us) again/i,
  /not interested (anymore|at all)/i,
  /this is pointless/i,
  /stop wasting my time/i,
  /f[\*u]ck (off|you|this)/i,
  /get (lost|out of here)/i,
  /i'?m done (with this|talking)/i,
  /you'?re (fired|dismissed)/i,
  /end this (call|meeting|conversation)/i,
];

export default function PracticePage({ uploadedBooks }) {
  const [messages, setMessages] = useState([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [negotiationPhase, setNegotiationPhase] = useState(false);
  const [currentProposedValue, setCurrentProposedValue] = useState(null);
  const [dealClosed, setDealClosed] = useState(false);
  const [dealLost, setDealLost] = useState(false);
  const [dealLostReason, setDealLostReason] = useState('');
  const [offContextCount, setOffContextCount] = useState(0);
  const [customerMood, setCustomerMood] = useState('moderate');
  const [scores, setScores] = useState({ ...EMPTY_SCORES });
  const [scoreRound, setScoreRound] = useState(0);
  const [scoresUpdating, setScoresUpdating] = useState(false);

  // Mobile popup state
  const [fabOpen, setFabOpen] = useState(false);
  const [fabTab, setFabTab] = useState('scores'); // 'scores' | 'mood'

  const messagesEndRef = useRef(null);
  const offContextRef = useRef(0);
  const popupRef = useRef(null);

  const { transcript, isRecording, startRecording, stopRecording, clearTranscript } =
    useSpeechRecognition();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAnalyzing]);

  // Close popup on outside tap
  useEffect(() => {
    if (!fabOpen) return;
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setFabOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [fabOpen]);

  const addMessages = (...newMsgs) =>
    setMessages(prev => [...prev, ...newMsgs]);

  const updateScoresFromText = (text) => {
    const extracted = extractDimensionScores(text);
    const hasAny = Object.values(extracted).some(v => v !== null);
    if (hasAny) {
      setScoresUpdating(true);
      setScores(prev => {
        const merged = { ...prev };
        for (const key of Object.keys(extracted)) {
          if (extracted[key] !== null) merged[key] = extracted[key];
        }
        return merged;
      });
      setScoreRound(r => r + 1);
      setTimeout(() => setScoresUpdating(false), 1200);
    }
  };

  const isOffContextFeedback = (text) => OFF_CONTEXT_SIGNALS.some(re => re.test(text));
  const isRudeOrDismissive   = (text) => RUDE_PATTERNS.some(re => re.test(text));

  const triggerDealLost = (reason, customerMessage) => {
    setDealLost(true);
    setDealLostReason(reason);
    addMessages({ role: 'assistant', content: customerMessage, type: 'deal-lost' });
  };

  const handleOffContextStrike = (userText) => {
    const newCount = offContextRef.current + 1;
    offContextRef.current = newCount;
    setOffContextCount(newCount);
    const remaining = OFF_CONTEXT_LIMIT - newCount;

    if (newCount >= OFF_CONTEXT_LIMIT) {
      addMessages({ role: 'user', content: userText });
      setTimeout(() => {
        triggerDealLost(
          `Went off-topic ${OFF_CONTEXT_LIMIT} times`,
          "I've tried to stay engaged, but your responses keep missing the point. Goodbye."
        );
      }, 500);
      return true;
    } else {
      const warningMsg = remaining === 1
        ? `⚠️ Your response didn't address my question. This is your last chance — one more off-topic answer and I'm walking away.`
        : `⚠️ Your response didn't address my question. Please stay focused. (${remaining} warning${remaining > 1 ? 's' : ''} remaining)`;
      addMessages({ role: 'user', content: userText });
      setTimeout(() => {
        addMessages({ role: 'assistant', content: warningMsg, type: 'off-context-warning' });
      }, 400);
      return false;
    }
  };

  const startSession = async () => {
    try {
      const res = await fetch(`${API}/api/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerMood }),
      });
      const data = await res.json();
      setMessages([{
        role: 'assistant',
        content: data.initialPrompt || "Welcome! I'm your AI sales coach. Start by recording your pitch.",
        type: 'intro',
      }]);
      setSessionStarted(true);
    } catch {
      alert('Failed to start session. Check backend and uploaded books.');
    }
  };

  const startFresh = () => {
    setMessages([]);
    setSessionStarted(false);
    setIsAnalyzing(false);
    setNegotiationPhase(false);
    setCurrentProposedValue(null);
    setDealClosed(false);
    setDealLost(false);
    setDealLostReason('');
    setOffContextCount(0);
    offContextRef.current = 0;
    setScores({ ...EMPTY_SCORES });
    setScoreRound(0);
    setCustomerMood('moderate');
    setFabOpen(false);
    clearTranscript();
    if (isRecording) stopRecording();
  };

  const postJSON = async (endpoint, body) => {
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, customerMood }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Request failed');
    return data;
  };

  const handleSubmit = async () => {
    if (!transcript.trim() || isAnalyzing) return;
    const text = transcript.trim();
    setIsAnalyzing(true);
    clearTranscript();

    try {
      const lastMsg = messages[messages.length - 1];
      const isNegotiationPrompt = lastMsg?.type === 'negotiation-prompt';

      if (isRudeOrDismissive(text)) {
        addMessages({ role: 'user', content: text });
        setTimeout(() => {
          triggerDealLost('Unprofessional behavior',
            "I'm sorry, but this conversation is over. Your approach was unprofessional. Goodbye.");
        }, 500);
        setIsAnalyzing(false);
        return;
      }

      if (isNegotiationPrompt || negotiationPhase) {
        if (isNegotiationPrompt) {
          const data = await postJSON('/api/start-negotiation', { userResponse: text });
          addMessages(
            { role: 'user', content: text },
            { role: 'assistant', content: data.message, type: data.negotiationStarted ? 'negotiation' : 'feedback' }
          );
          if (data.negotiationStarted) setNegotiationPhase(true);
          if (data.dealLost) {
            triggerDealLost('Customer walked away', data.message);
          } else if (isOffContextFeedback(data.message)) {
            const lost = handleOffContextStrike(text);
            if (lost) { setIsAnalyzing(false); return; }
          }
          updateScoresFromText(data.message);

        } else if (!currentProposedValue) {
          const data = await postJSON('/api/propose-price', { priceProposal: text });
          const priceMatch = text.match(/\$?[\d,]+(?:\.\d{2})?/);
          setCurrentProposedValue(priceMatch?.[0] || text);
          addMessages(
            { role: 'user', content: `Proposed value: ${text}`, type: 'price-proposal' },
            { role: 'assistant', content: data.counterOffer, type: 'counter-offer' }
          );
          if (data.dealLost) triggerDealLost('Customer walked away during negotiation', data.counterOffer);
          updateScoresFromText(data.counterOffer);

        } else {
          const data = await postJSON('/api/negotiate-response', { response: text });
          if (data.dealClosed) {
            setDealClosed(true);
            setCurrentProposedValue(data.finalValue);
          }
          if (data.dealLost) {
            triggerDealLost('Customer walked away during negotiation', data.message);
          } else {
            addMessages(
              { role: 'user', content: text },
              { role: 'assistant', content: data.message, type: data.dealClosed ? 'deal-closed' : 'negotiation' }
            );
          }
          updateScoresFromText(data.message);
        }

      } else if (messages.length <= 1) {
        const data = await postJSON('/api/analyze-pitch', { pitch: text });
        addMessages(
          { role: 'user', content: text },
          { role: 'assistant', content: data.analysis, type: 'analysis' }
        );
        if (data.dealLost) {
          triggerDealLost('Poor pitch', data.analysis);
        } else if (isOffContextFeedback(data.analysis)) {
          handleOffContextStrike(text);
        }
        updateScoresFromText(data.analysis);

      } else {
        const data = await postJSON('/api/analyze-response', { response: text });

        if (data.dealLost) {
          addMessages({ role: 'user', content: text });
          triggerDealLost('Customer lost interest', data.feedback);

        } else if (isOffContextFeedback(data.feedback)) {
          const lost = handleOffContextStrike(text);
          if (!lost) {
            setTimeout(() => {
              addMessages({ role: 'assistant', content: data.feedback, type: 'feedback' });
              updateScoresFromText(data.feedback);
            }, 900);
          }

        } else {
          if (offContextRef.current > 0) {
            offContextRef.current = 0;
            setOffContextCount(0);
          }
          addMessages(
            { role: 'user', content: text },
            { role: 'assistant', content: data.feedback, type: 'feedback' }
          );
          updateScoresFromText(data.feedback);

          if (data.shouldAskNegotiation) {
            setTimeout(() => {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: "I liked your program. Are you ready for negotiation now?",
                type: 'negotiation-prompt',
              }]);
            }, 800);
          }
        }
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPhaseLabel = () => {
    if (dealLost)             return { label: 'Deal Lost',   color: 'var(--danger)' };
    if (dealClosed)           return { label: 'Complete',    color: 'var(--accent)' };
    if (negotiationPhase)     return { label: 'Negotiation', color: 'var(--accent-2)' };
    if (!sessionStarted)      return { label: 'Ready',       color: 'var(--text-muted)' };
    if (messages.length <= 1) return { label: 'Pitch',       color: 'var(--purple)' };
    return                           { label: 'Q&A',         color: 'var(--accent-3)' };
  };

  const phase = getPhaseLabel();

  const btnLabel = () => {
    if (!sessionStarted)       return 'Record Your Pitch';
    if (messages.length <= 1)  return 'Record Pitch';
    if (negotiationPhase)      return 'Record Response';
    return 'Record Answer';
  };

  const strikeDisplay = sessionStarted && !dealLost && offContextCount > 0;
  const moodColors = { happy: '#3B6D11', moderate: '#185FA5', aggressive: '#A32D2D' };
  const moodLabels = { happy: 'Happy', moderate: 'Moderate', aggressive: 'Aggressive' };

  // Has any score been set yet?
  const hasScores = Object.values(scores).some(v => v !== null);

  return (
    <div className="practice-page">

      {/* ── Left Sidebar (desktop) ────────────────── */}
      <aside className="practice-sidebar">
        <div className="sidebar-section">
          <div className="sidebar-label">Session Phase</div>
          <div className="phase-badge" style={{
            color: phase.color,
            borderColor: phase.color + '33',
            background: phase.color + '11',
          }}>
            {phase.label}
          </div>
        </div>

        {strikeDisplay && (
          <div className="sidebar-section">
            <div className="sidebar-label">Off-Topic Strikes</div>
            <div className="strike-tracker">
              {Array.from({ length: OFF_CONTEXT_LIMIT }).map((_, i) => (
                <div key={i} className={`strike-dot ${i < offContextCount ? 'active' : ''}`} />
              ))}
              <span className="strike-label">{OFF_CONTEXT_LIMIT - offContextCount} left</span>
            </div>
          </div>
        )}

        {currentProposedValue && (
          <div className="sidebar-section">
            <div className="sidebar-label">Proposed Value</div>
            <div className="proposed-value">
              <DollarSign size={14} />
              <span>{currentProposedValue}</span>
            </div>
          </div>
        )}

        <div className="sidebar-section books-sidebar">
          <div className="sidebar-label">Loaded Books</div>
          <ul className="sidebar-books">
            {uploadedBooks.map((b, i) => (
              <li key={i} className="sidebar-book">{b}</li>
            ))}
          </ul>
        </div>

        <div className="sidebar-bottom">
          <button className="fresh-btn" onClick={startFresh}>
            <RotateCcw size={14} />
            New Session
          </button>
        </div>
      </aside>

      {/* ── Mobile Info Bar ───────────────────────── */}
      <div className="mobile-info-bar">
        <div className="mobile-info-chip">
          <span className="chip-label">Phase:</span>
          <span style={{ color: phase.color, fontWeight: 700 }}>{phase.label}</span>
        </div>

        {sessionStarted && (
          <div className="mobile-info-chip">
            <span className="chip-label">Mood:</span>
            <span style={{ color: moodColors[customerMood] }}>{moodLabels[customerMood]}</span>
          </div>
        )}

        {currentProposedValue && (
          <div className="mobile-info-chip">
            <DollarSign size={10} />
            <span>{currentProposedValue}</span>
          </div>
        )}

        {strikeDisplay && (
          <div className="mobile-info-chip" style={{ borderColor: 'rgba(252,129,129,0.3)' }}>
            <span style={{ color: 'var(--danger)' }}>
              ⚠️ {offContextCount}/{OFF_CONTEXT_LIMIT} strikes
            </span>
          </div>
        )}

        <button
          className="mobile-info-chip mobile-reset-chip"
          onClick={startFresh}
        >
          <RotateCcw size={10} />
          Reset
        </button>
      </div>

      {/* ── Chat Area ─────────────────────────────── */}
      <div className="chat-area">
        <div className="chat-messages">
          {!sessionStarted ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">🎯</div>
              <h3>Ready to practice?</h3>
              <p>Start a session and the AI will guide you through your pitch, give feedback, and simulate negotiations.</p>
              <button className="start-btn" onClick={startSession}>
                Start Practice Session
              </button>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <ChatMessage key={i} msg={msg} index={i} />
              ))}
              {isAnalyzing && (
                <div className="chat-message assistant">
                  <div className="msg-avatar">AI</div>
                  <div className="msg-bubble assistant">
                    <div className="typing-dots"><span /><span /><span /></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        {sessionStarted && !dealClosed && !dealLost && (
          <div className="chat-input-area">
            {transcript && (
              <div className="transcript-preview">
                <span className="transcript-label">Transcript</span>
                <p>{transcript}</p>
              </div>
            )}
            <div className="chat-controls">
              {isRecording ? (
                <button className="ctrl-btn recording" onClick={stopRecording}>
                  <div className="recording-ring" />
                  <MicOff size={16} />
                  Stop
                </button>
              ) : (
                <button className="ctrl-btn record" onClick={startRecording} disabled={isAnalyzing}>
                  <Mic size={16} />
                  {transcript ? 'Re-record' : btnLabel()}
                </button>
              )}
              <button
                className="ctrl-btn submit"
                onClick={handleSubmit}
                disabled={!transcript.trim() || isAnalyzing || isRecording}
              >
                {isAnalyzing ? <span className="auth-spinner small" /> : <Send size={16} />}
                {isAnalyzing ? 'Analyzing…' : 'Submit'}
              </button>
            </div>
            <p className="chat-hint">
              {isAnalyzing   ? '🤖 AI is analyzing your response…'
               : isRecording ? '🎤 Recording — speak naturally, then stop'
               : transcript  ? '✅ Ready — submit or record again'
               :               '🎯 Record your response, then submit'}
            </p>
          </div>
        )}

        {dealClosed && !dealLost && (
          <div className="deal-closed-bar">
            <span>🎉 Negotiation complete — great work!</span>
            <button className="fresh-btn" onClick={startFresh}>
              <RotateCcw size={14} /> New Session
            </button>
          </div>
        )}

        {dealLost && (
          <div className="deal-lost-bar">
            <div className="deal-lost-left">
              <span className="deal-lost-icon">💔</span>
              <div>
                <span className="deal-lost-title">You Lost This Deal</span>
                <span className="deal-lost-sub">{dealLostReason}</span>
              </div>
            </div>
            <button className="fresh-btn danger" onClick={startFresh}>
              <RotateCcw size={14} /> Try Again
            </button>
          </div>
        )}
      </div>

      {/* ── Right Panel (desktop) ─────────────────── */}
      <div className="right-panel">
        <CustomerMoodPanel
          selectedMood={customerMood}
          onMoodChange={setCustomerMood}
          disabled={sessionStarted}
        />
        <ScoresPanel scores={scores} isUpdating={scoresUpdating} roundCount={scoreRound} />
      </div>

      {/* ══════════════════════════════════════════════
          MOBILE FAB + POPUP — only rendered on mobile
      ══════════════════════════════════════════════ */}
      <div className="mobile-fab-root" ref={popupRef}>

        {/* Popup card */}
        <div className={`fab-popup ${fabOpen ? 'fab-popup--open' : ''}`}>
          {/* Popup header with tabs */}
          <div className="fab-popup-header">
            <div className="fab-popup-tabs">
              <button
                className={`fab-popup-tab ${fabTab === 'scores' ? 'fab-popup-tab--active' : ''}`}
                onClick={() => setFabTab('scores')}
              >
                <BarChart2 size={13} />
                Performance
              </button>
              <button
                className={`fab-popup-tab ${fabTab === 'mood' ? 'fab-popup-tab--active' : ''}`}
                onClick={() => setFabTab('mood')}
              >
                <Smile size={13} />
                Mood
              </button>
            </div>
            <button className="fab-popup-close" onClick={() => setFabOpen(false)}>
              <X size={15} />
            </button>
          </div>

          {/* Popup content */}
          <div className="fab-popup-body">
            {fabTab === 'scores' && (
              <ScoresPanel scores={scores} isUpdating={scoresUpdating} roundCount={scoreRound} />
            )}
            {fabTab === 'mood' && (
              <CustomerMoodPanel
                selectedMood={customerMood}
                onMoodChange={setCustomerMood}
                disabled={sessionStarted}
              />
            )}
          </div>
        </div>

        {/* FAB button */}
        <button
          className={`fab-btn ${fabOpen ? 'fab-btn--open' : ''}`}
          onClick={() => setFabOpen(prev => !prev)}
          aria-label="Toggle stats & mood"
        >
          {fabOpen ? (
            <X size={20} />
          ) : (
            <>
              <BarChart2 size={19} />
              {/* Score badge — shows current overall or pulse dot */}
              {hasScores && (
                <span className="fab-score-badge">
                  {(Object.values(scores).filter(v => v !== null).reduce((a, b) => a + b, 0) /
                    Object.values(scores).filter(v => v !== null).length).toFixed(1)}
                </span>
              )}
              {scoresUpdating && <span className="fab-pulse" />}
            </>
          )}
        </button>
      </div>

    </div>
  );
}