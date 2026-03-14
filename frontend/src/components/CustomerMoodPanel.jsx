import React from 'react';
import './CustomerMoodPanel.css';

const MOODS = [
  {
    key: 'happy',
    label: 'Happy & Interested',
    desc: 'Warm, curious, receptive buyer',
    color: '#3B6D11',
    bg: 'rgba(59,109,17,0.08)',
    avatarBg: 'rgba(59,109,17,0.15)',
    badgeColor: '#3B6D11',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="#3B6D11" strokeWidth="1.2"/>
        <circle cx="6" cy="6.5" r="1" fill="#3B6D11"/>
        <circle cx="10" cy="6.5" r="1" fill="#3B6D11"/>
        <path d="M5.5 9.5 Q8 11.5 10.5 9.5" stroke="#3B6D11" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      </svg>
    ),
    moodDescription: 'Buyer is enthusiastic and genuinely interested. They ask friendly questions, respond positively to your pitch, and are easy to negotiate with. Great for building confidence.',
  },
  {
    key: 'moderate',
    label: 'Moderate / Normal',
    desc: 'Balanced, professional buyer',
    color: '#185FA5',
    bg: 'rgba(24,95,165,0.08)',
    avatarBg: 'rgba(24,95,165,0.15)',
    badgeColor: '#185FA5',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="#0C447C" strokeWidth="1.2"/>
        <circle cx="6" cy="6.5" r="1" fill="#0C447C"/>
        <circle cx="10" cy="6.5" r="1" fill="#0C447C"/>
        <line x1="5.5" y1="10" x2="10.5" y2="10" stroke="#0C447C" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    moodDescription: 'Buyer asks balanced, professional questions. They negotiate fairly and need to be genuinely convinced. Reflects a realistic everyday sales scenario.',
  },
  {
    key: 'aggressive',
    label: 'Aggressive / Impolite',
    desc: 'Demanding, skeptical, abrupt',
    color: '#A32D2D',
    bg: 'rgba(163,45,45,0.08)',
    avatarBg: 'rgba(163,45,45,0.15)',
    badgeColor: '#A32D2D',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="#A32D2D" strokeWidth="1.2"/>
        <circle cx="6" cy="6.5" r="1" fill="#A32D2D"/>
        <circle cx="10" cy="6.5" r="1" fill="#A32D2D"/>
        <path d="M5.5 10.5 Q8 8.5 10.5 10.5" stroke="#A32D2D" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        <line x1="4.5" y1="5" x2="7" y2="4" stroke="#A32D2D" strokeWidth="1" strokeLinecap="round"/>
        <line x1="11.5" y1="5" x2="9" y2="4" stroke="#A32D2D" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
    moodDescription: 'Buyer is demanding, skeptical, and may use pressure tactics. Expect blunt objections and tough counter-offers. Use this to sharpen resilience.',
  },
];

export default function CustomerMoodPanel({ selectedMood, onMoodChange, disabled }) {
  const activeMood = MOODS.find(m => m.key === selectedMood) || MOODS[1];

  return (
    <aside className="mood-panel">
      <div className="mood-panel-header">
        <span className="mood-panel-title">Customer Mood</span>
        {disabled && (
          <span className="mood-locked-badge">Locked</span>
        )}
      </div>

      <div className="mood-cards">
        {MOODS.map(mood => {
          const isActive = selectedMood === mood.key;
          return (
            <button
              key={mood.key}
              className={`mood-card${isActive ? ' mood-card--active' : ''}${disabled ? ' mood-card--disabled' : ''}`}
              onClick={() => !disabled && onMoodChange(mood.key)}
              disabled={disabled}
              style={isActive ? {
                borderColor: mood.color,
                background: mood.bg,
              } : {}}
              title={disabled ? 'Start a new session to change mood' : `Set mood: ${mood.label}`}
            >
              <div className="mood-card-row">
                <div
                  className="mood-avatar"
                  style={isActive ? { background: mood.avatarBg } : {}}
                >
                  {mood.icon}
                </div>
                <div className="mood-text">
                  <span
                    className="mood-label"
                    style={isActive ? { color: mood.color } : {}}
                  >
                    {mood.label}
                  </span>
                  <span className="mood-subdesc">{mood.desc}</span>
                </div>
                {isActive && (
                  <div
                    className="mood-active-dot"
                    style={{ background: mood.color }}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mood-description-box">
        <div
          className="mood-desc-indicator"
          style={{ background: activeMood.color }}
        />
        <p className="mood-desc-text">{activeMood.moodDescription}</p>
      </div>

      {disabled && (
        <p className="mood-hint">Reset session to change mood</p>
      )}
    </aside>
  );
}