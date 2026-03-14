import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, ChevronRight, RotateCcw, Send, Mic, MicOff,
  Target, TrendingUp, Users, AlertCircle, Trophy, Plus,
  ArrowLeft, CheckCircle, BookOpen, Zap, Clock, Star
} from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import './TutorialPage.css';

const API = import.meta.env.VITE_BACKEND_URL;

/* ── Tag color map ─────────────────────────────────────── */
const TAG_META = {
  'Lead Generation':    { color: '#6EE7B7', bg: 'rgba(110,231,183,0.12)', icon: Target },
  'Deal Closure':       { color: '#93C5FD', bg: 'rgba(147,197,253,0.12)', icon: Trophy },
  'Upset Customer':     { color: '#FCA5A5', bg: 'rgba(252,165,165,0.12)', icon: AlertCircle },
  'Objection Handling': { color: '#FCD34D', bg: 'rgba(252,211,77,0.12)',  icon: TrendingUp },
  'Discovery Call':     { color: '#C4B5FD', bg: 'rgba(196,181,253,0.12)', icon: Users },
  'ROI Justification':  { color: '#F9A8D4', bg: 'rgba(249,168,212,0.12)', icon: Star },
  'Competitive Sales':  { color: '#6EE7B7', bg: 'rgba(110,231,183,0.12)', icon: Zap },
};

function getTagMeta(tag) {
  return TAG_META[tag] || { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: Sparkles };
}

/* ── Difficulty badge ──────────────────────────────────── */
function DiffBadge({ level }) {
  const map = {
    Beginner:     { color: '#6EE7B7' },
    Intermediate: { color: '#FCD34D' },
    Advanced:     { color: '#FCA5A5' },
  };
  const m = map[level] || map['Beginner'];
  return (
    <span className="diff-badge" style={{ color: m.color, borderColor: m.color + '44', background: m.color + '15' }}>
      {level}
    </span>
  );
}

/* ── Scenario Card ─────────────────────────────────────── */
function ScenarioCard({ scenario, index, onAttempt, isNew }) {
  const tagMeta = getTagMeta(scenario.tag);
  const TagIcon = tagMeta.icon;
  return (
    <div
      className={`scenario-card ${isNew ? 'scenario-card--new' : ''}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="scenario-card__number"><span>{String(index + 1).padStart(2, '0')}</span></div>
      <div className="scenario-card__tag" style={{ color: tagMeta.color, background: tagMeta.bg }}>
        <TagIcon size={11} /><span>{scenario.tag}</span>
      </div>
      <h3 className="scenario-card__title">{scenario.title}</h3>
      <p className="scenario-card__context">{scenario.context}</p>
      <div className="scenario-card__footer">
        <div className="scenario-card__meta">
          <DiffBadge level={scenario.difficulty} />
          <span className="scenario-card__time"><Clock size={11} />{scenario.estimatedTime}</span>
        </div>
        <button className="scenario-card__btn" onClick={() => onAttempt(scenario, index)}>
          Attempt <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ── Feedback Block ────────────────────────────────────── */
function FeedbackDisplay({ text }) {
  const lines = text.split('\n').filter(l => l.trim());
  return (
    <div className="feedback-display">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**'))
          return <h4 key={i} className="feedback-section-title">{line.replace(/\*\*/g, '')}</h4>;
        if (line.match(/^\*\*.*\*\*/))
          return <p key={i} className="feedback-bold" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />;
        if (line.startsWith('- ') || line.startsWith('• '))
          return <div key={i} className="feedback-item"><span className="feedback-dot" />{line.slice(2)}</div>;
        return <p key={i} className="feedback-para">{line}</p>;
      })}
    </div>
  );
}

/* ── Default Scenarios ─────────────────────────────────── */
const DEFAULT_SCENARIOS = [
  {
    id: 'sc-1', tag: 'Lead Generation', title: 'Cold Outreach: Skeptical IT Head',
    context: "You've just connected with Rajesh Malhotra, Head of IT at a mid-size fintech firm. He's heard of AI tools but never invested in structured training. He says: \"We already use ChatGPT informally. Why do we need a formal training program?\"",
    difficulty: 'Beginner', estimatedTime: '5–8 min',
    customerPersona: 'Skeptical but open-minded IT leader who thinks informal AI usage is sufficient.',
  },
  {
    id: 'sc-2', tag: 'Objection Handling', title: 'Budget Pushback from Finance Director',
    context: "Priya Sharma, Finance Director at a logistics company, has reviewed your proposal. She says: \"Your pricing is 3x what we'd pay for an online course. I don't see how cohort-based training justifies this cost.\"",
    difficulty: 'Intermediate', estimatedTime: '6–10 min',
    customerPersona: 'Numbers-driven executive who needs hard ROI data and a compelling cost-benefit case.',
  },
  {
    id: 'sc-3', tag: 'Upset Customer', title: 'Post-Training Dissatisfaction',
    context: "You receive a call from Vikram Nair, L&D Head, whose team completed your GenAI Training 3 months ago. He's frustrated: \"Honestly, we're disappointed. Our team still isn't using these tools in their daily work. We feel like we wasted ₹8 lakhs.\"",
    difficulty: 'Advanced', estimatedTime: '8–12 min',
    customerPersona: 'Frustrated client who feels let down and is weighing whether to escalate or demand a refund.',
  },
  {
    id: 'sc-4', tag: 'Competitive Sales', title: 'Competing Against a Global Brand',
    context: "Ananya Desai, HR Head at an e-commerce giant, is evaluating you alongside a global player. She says: \"Coursera and Google are also pitching to us. They have more content, global certifications, and a brand name. Why should we go with NIIT's GenAI Training?\"",
    difficulty: 'Advanced', estimatedTime: '7–10 min',
    customerPersona: 'Analytical decision-maker comparing options, leaning toward a well-known brand.',
  },
  {
    id: 'sc-5', tag: 'Deal Closure', title: 'Final Push Before Quarter Close',
    context: "You've had three great meetings with Suresh Pillai, CEO of a healthcare startup. He's interested but keeps saying \"let's revisit next quarter.\" It's the last week of the quarter. You need to close today.",
    difficulty: 'Intermediate', estimatedTime: '6–9 min',
    customerPersona: 'Interested but cautious CEO who is procrastinating and needs a gentle but firm push to decide.',
  },
];

/* ── Main Component ────────────────────────────────────── */
export default function TutorialPage() {
  const [scenarios, setScenarios]           = useState(DEFAULT_SCENARIOS);
  const [activeScenario, setActiveScenario] = useState(null);
  const [newScenarioIds, setNewScenarioIds] = useState(new Set());
  const [messages, setMessages]             = useState([]);
  const [isLoading, setIsLoading]           = useState(false);
  const [isGenerating, setIsGenerating]     = useState(false);
  const [attemptDone, setAttemptDone]       = useState(false);
  const [error, setError]                   = useState('');

  const messagesEndRef = useRef(null);
  const { transcript, isRecording, startRecording, stopRecording, clearTranscript } =
    useSpeechRecognition();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const callLiteLLM = async (systemPrompt, userContent) => {
    const res = await fetch(`${API}/api/tutorial-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userContent }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `HTTP ${res.status}`); }
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Request failed');
    return data.result;
  };

  const handleAttempt = (scenario) => {
    setActiveScenario(scenario);
    setMessages([{ role: 'assistant', isCustomer: true, text: scenario.context }]);
    setAttemptDone(false); setError(''); clearTranscript();
  };

  const handleSubmit = async () => {
    if (!transcript.trim() || isLoading || attemptDone) return;
    const userText = transcript.trim();
    clearTranscript(); setError('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);
    try {
      const systemPrompt = `You are a GenAI Training sales coach evaluating a trainee salesperson.

SCENARIO: ${activeScenario.title}
CUSTOMER PERSONA: ${activeScenario.customerPersona}
SCENARIO CONTEXT: ${activeScenario.context}
TAG: ${activeScenario.tag}
DIFFICULTY: ${activeScenario.difficulty}

Respond with exactly this format:

**Overall Score:** X/10

**What You Did Well:**
- Point 1
- Point 2

**What Could Be Better:**
- Point 1
- Point 2

**Ideal Response Example:**
Write a 2-3 sentence ideal response they could have used.

**Key Takeaway:**
One memorable lesson from this scenario.`;
      const feedback = await callLiteLLM(systemPrompt, userText);
      setMessages(prev => [...prev, { role: 'assistant', isFeedback: true, text: feedback }]);
      setAttemptDone(true);
    } catch (err) { setError('Could not get feedback — ' + err.message); }
    finally { setIsLoading(false); }
  };

  const handleGenerateMore = async () => {
    setIsGenerating(true); setError('');
    try {
      const existingTitles = scenarios.map(s => s.title).join(', ');
      const ts = Date.now();
      const systemPrompt = `You are a sales training expert. Generate exactly 2 NEW and UNIQUE scenario cards for a GenAI Training sales training app.
Existing scenarios (do NOT repeat): ${existingTitles}
IMPORTANT: Respond ONLY with valid JSON — no markdown fences.
[{"id":"sc-${ts}-1","tag":"Lead Generation|Deal Closure|Upset Customer|Objection Handling|Discovery Call|ROI Justification|Competitive Sales","title":"Short title","context":"2-3 sentences ending with customer challenge","difficulty":"Beginner|Intermediate|Advanced","estimatedTime":"X–Y min","customerPersona":"One sentence"},{"id":"sc-${ts}-2",...}]
All scenarios must be about selling the GenAI Training Program.`;
      const raw = await callLiteLLM(systemPrompt, 'Generate 2 new unique scenarios.');
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      const newIds = new Set(parsed.map(s => s.id));
      setNewScenarioIds(newIds);
      setScenarios(prev => [...prev, ...parsed]);
      setTimeout(() => setNewScenarioIds(new Set()), 3000);
    } catch (err) { setError('Failed to generate scenarios — ' + err.message); }
    finally { setIsGenerating(false); }
  };

  const resetAttempt = () => {
    if (isRecording) stopRecording();
    clearTranscript(); setAttemptDone(false); setError('');
    setMessages([{ role: 'assistant', isCustomer: true, text: activeScenario.context }]);
  };

  const goBack = () => {
    if (isRecording) stopRecording();
    setActiveScenario(null); setMessages([]); setAttemptDone(false); setError(''); clearTranscript();
  };

  /* ── Practice view ─────────────────────────────────── */
  if (activeScenario) {
    const tagMeta = getTagMeta(activeScenario.tag);
    const TagIcon = tagMeta.icon;

    return (
      <div className="tutorial-practice">

        {/* ── Top bar: restructured for mobile ── */}
        <div className="practice-topbar">
          {/* Row 1: back + tag + diff badge */}
          <button className="back-btn" onClick={goBack}>
            <ArrowLeft size={14} />
            Back
          </button>

          <div className="practice-scenario-title">
            <div className="practice-tag" style={{ color: tagMeta.color, background: tagMeta.bg }}>
              <TagIcon size={10} />
              <span>{activeScenario.tag}</span>
            </div>
            {/* Title hidden on mobile via CSS, shown on desktop */}
            <span>{activeScenario.title}</span>
          </div>

          <DiffBadge level={activeScenario.difficulty} />
        </div>

        {/* ── Scenario title strip (mobile only) ── */}
        

        {/* ── Chat ── */}
        <div className="practice-chat-wrap">
          <div className="practice-chat">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`practice-msg ${msg.isCustomer ? 'customer' : msg.isFeedback ? 'feedback' : 'user'}`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {msg.isCustomer && <div className="practice-msg__avatar customer-avatar"><Users size={12} /></div>}
                {msg.isFeedback && <div className="practice-msg__avatar feedback-avatar"><Sparkles size={12} /></div>}
                <div className={`practice-msg__bubble ${msg.isCustomer ? 'customer-bubble' : msg.isFeedback ? 'feedback-bubble' : 'user-bubble'}`}>
                  {msg.isCustomer && <div className="bubble-label">Customer</div>}
                  {msg.isFeedback && <div className="bubble-label feedback-label"><Sparkles size={10} /> AI Coach Feedback</div>}
                  {msg.isFeedback ? <FeedbackDisplay text={msg.text} /> : <p>{msg.text}</p>}
                </div>
                {!msg.isCustomer && !msg.isFeedback && <div className="practice-msg__avatar user-avatar">You</div>}
              </div>
            ))}
            {isLoading && (
              <div className="practice-msg feedback">
                <div className="practice-msg__avatar feedback-avatar"><Sparkles size={12} /></div>
                <div className="practice-msg__bubble feedback-bubble">
                  <div className="bubble-label feedback-label"><Sparkles size={10} /> AI Coach Feedback</div>
                  <div className="typing-dots"><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Input ── */}
        <div className="practice-input-area">
          {error && <p className="tutorial-error">{error}</p>}
          {attemptDone ? (
            <div className="attempt-done-bar">
              <div className="attempt-done-left">
                <CheckCircle size={17} style={{ color: '#6EE7B7', flexShrink: 0 }} />
                <span>Feedback received! Try again or pick a new scenario.</span>
              </div>
              <div className="attempt-done-actions">
                <button className="retry-btn" onClick={resetAttempt}><RotateCcw size={13} />Try Again</button>
                <button className="newscene-btn" onClick={goBack}><BookOpen size={13} />New Scenario</button>
              </div>
            </div>
          ) : (
            <>
              {transcript && (
                <div className="transcript-preview">
                  <span className="transcript-label">Your Response</span>
                  <p>{transcript}</p>
                </div>
              )}
              <div className="practice-controls">
                {isRecording ? (
                  <button className="ctrl-btn recording" onClick={stopRecording}>
                    <div className="recording-ring" /><MicOff size={15} />Stop Recording
                  </button>
                ) : (
                  <button className="ctrl-btn record" onClick={startRecording} disabled={isLoading}>
                    <Mic size={15} />{transcript ? 'Record Again' : 'Record Your Response'}
                  </button>
                )}
                <button
                  className="ctrl-btn submit"
                  onClick={handleSubmit}
                  disabled={!transcript.trim() || isLoading || isRecording}
                >
                  {isLoading ? <span className="mini-spinner" /> : <Send size={14} />}
                  {isLoading ? 'Analyzing…' : 'Get Feedback'}
                </button>
              </div>
              <p className="practice-hint">
                {isLoading ? '🤖 AI Coach is evaluating…'
                 : isRecording ? '🎤 Recording — speak naturally, then stop'
                 : transcript ? '✅ Ready — submit for feedback or record again'
                 : "🎯 Record how you'd respond to the customer"}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Scenario list view ────────────────────────────── */
  return (
    <div className="tutorial-page">
      <div className="tutorial-hero animate-fadeUp">
        <div className="tutorial-hero__eyebrow"><Zap size={13} /><span>Interactive Training</span></div>
        <h1 className="tutorial-hero__title">
          Sales Scenario<span className="tutorial-hero__accent"> Practice</span>
        </h1>
        <p className="tutorial-hero__sub">
          Pick a real-world GenAI Training sales scenario, record your response,
          and get instant AI coaching on how to handle it better.
        </p>
        <div className="tutorial-hero__stats">
          <div className="hero-stat">
            <span className="hero-stat__num">{scenarios.length}</span>
            <span className="hero-stat__label">Scenarios</span>
          </div>
          <div className="hero-stat__sep" />
          <div className="hero-stat">
            <span className="hero-stat__num">3</span>
            <span className="hero-stat__label">Difficulty Levels</span>
          </div>
          <div className="hero-stat__sep" />
          <div className="hero-stat">
            <span className="hero-stat__num">AI</span>
            <span className="hero-stat__label">Instant Feedback</span>
          </div>
        </div>
      </div>

      <div className="how-it-works animate-fadeUp">
        {[
          { icon: BookOpen, label: 'Pick a Scenario', desc: 'Choose based on skill area and difficulty' },
          { icon: Mic,      label: 'Record Response', desc: 'Speak your answer as you would to a real client' },
          { icon: Sparkles, label: 'Get AI Feedback',  desc: 'Receive detailed coaching on what to improve' },
        ].map((step, i) => (
          <div key={i} className="how-step">
            <div className="how-step__icon"><step.icon size={17} /></div>
            <div>
              <div className="how-step__label">{step.label}</div>
              <div className="how-step__desc">{step.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="scenarios-section">
        <div className="scenarios-header">
          <h2 className="scenarios-title">Choose a Scenario</h2>
          <span className="scenarios-count">{scenarios.length} available</span>
        </div>

        <div className="scenarios-grid">
          {scenarios.map((sc, i) => (
            <ScenarioCard key={sc.id} scenario={sc} index={i} onAttempt={handleAttempt} isNew={newScenarioIds.has(sc.id)} />
          ))}
        </div>

        {error && <p className="tutorial-error center">{error}</p>}

        <div className="generate-more-wrap">
          <button
            className={`generate-more-btn ${isGenerating ? 'generating' : ''}`}
            onClick={handleGenerateMore}
            disabled={isGenerating}
          >
            {isGenerating
              ? <><span className="mini-spinner light" />Generating Scenarios…</>
              : <><Plus size={15} />Make More Scenarios<span className="generate-more-hint">+2 new</span></>}
          </button>
          <p className="generate-more-sub">AI will generate 2 fresh scenarios tailored to GenAI Training sales</p>
        </div>
      </div>
    </div>
  );
}