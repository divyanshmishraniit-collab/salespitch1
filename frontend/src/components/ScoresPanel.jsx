import React, { useEffect, useRef } from 'react';
import './ScoresPanel.css';

const METRICS = [
  {
    key: 'tone',
    label: 'Tone',
    icon: '🎙️',
    description: 'Confidence & warmth',
    color: '#b794f4',
    track: '#b794f41a',
  },
  {
    key: 'communication',
    label: 'Communication',
    icon: '💬',
    description: 'Clarity of delivery',
    color: '#63b3ed',
    track: '#63b3ed1a',
  },
  {
    key: 'content',
    label: 'Content',
    icon: '📋',
    description: 'Relevance & depth',
    color: '#68d391',
    track: '#68d3911a',
  },
  {
    key: 'queryHandling',
    label: 'Query Handling',
    icon: '🎯',
    description: 'On-topic responses',
    color: '#f6ad55',
    track: '#f6ad551a',
  },
  {
    key: 'closure',
    label: 'Closure',
    icon: '✅',
    description: 'Answer completeness',
    color: '#fc8181',
    track: '#fc81811a',
  },
];

function getScoreLabel(score) {
  if (score === null || score === undefined) return { text: '—', cls: 'empty' };
  if (score >= 8) return { text: 'Excellent', cls: 'excellent' };
  if (score >= 6) return { text: 'Good', cls: 'good' };
  if (score >= 4) return { text: 'Fair', cls: 'fair' };
  return { text: 'Needs Work', cls: 'poor' };
}

function ScoreBar({ metric, score, isNew }) {
  const pct = score !== null ? (score / 10) * 100 : 0;
  const label = getScoreLabel(score);
  const hasScore = score !== null && score !== undefined;

  return (
    <div className={`score-metric ${isNew ? 'animate-score-in' : ''}`}>
      <div className="score-metric-top">
        <div className="score-metric-left">
          <span className="score-icon">{metric.icon}</span>
          <div>
            <div className="score-metric-name">{metric.label}</div>
            <div className="score-metric-desc">{metric.description}</div>
          </div>
        </div>
        <div className="score-value-badge" style={hasScore ? { color: metric.color } : {}}>
          {hasScore ? score : '–'}<span className="score-denom">{hasScore ? '/10' : ''}</span>
        </div>
      </div>

      <div className="score-track" style={{ background: metric.track }}>
        <div
          className="score-fill"
          style={{
            width: `${pct}%`,
            background: hasScore ? metric.color : 'var(--bg-elevated)',
            boxShadow: hasScore ? `0 0 8px ${metric.color}55` : 'none',
          }}
        />
      </div>

      {hasScore && (
        <div className={`score-label-tag ${label.cls}`}>
          {label.text}
        </div>
      )}
    </div>
  );
}

function OverallRing({ scores }) {
  const values = Object.values(scores).filter(v => v !== null && v !== undefined);
  if (values.length === 0) return null;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const pct = (avg / 10) * 100;
  const r = 30;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  const color = avg >= 8 ? '#68d391' : avg >= 6 ? '#63b3ed' : avg >= 4 ? '#f6ad55' : '#fc8181';

  return (
    <div className="overall-ring-wrap">
      <div className="overall-ring-label-top">Overall</div>
      <div className="overall-ring">
        <svg width="76" height="76" viewBox="0 0 76 76">
          <circle cx="38" cy="38" r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth="5" />
          <circle
            cx="38" cy="38" r={r}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeDasharray={`${fill} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 38 38)"
            style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>
        <div className="overall-ring-center" style={{ color }}>
          <span className="overall-num">{avg.toFixed(1)}</span>
          <span className="overall-den">/10</span>
        </div>
      </div>
      <div className="overall-count">{values.length} / 5 scored</div>
    </div>
  );
}

export default function ScoresPanel({ scores, isUpdating, roundCount }) {
  const prevRoundRef = useRef(roundCount);
  const isNew = roundCount !== prevRoundRef.current;

  useEffect(() => {
    prevRoundRef.current = roundCount;
  }, [roundCount]);

  const hasAnyScore = Object.values(scores).some(v => v !== null && v !== undefined);

  return (
    <aside className="scores-panel">
      <div className="scores-panel-header">
        <span className="scores-panel-title">Performance</span>
        {isUpdating && <span className="scores-updating-dot" title="Updating…" />}
      </div>

      <div className="scores-panel-body">
        {!hasAnyScore ? (
          <div className="scores-empty">
            <div className="scores-empty-icon">📊</div>
            <p>Scores appear after your first response</p>
          </div>
        ) : (
          <>
            <OverallRing scores={scores} />
            <div className="scores-divider" />
          </>
        )}

        <div className="scores-list">
          {METRICS.map(metric => (
            <ScoreBar
              key={metric.key}
              metric={metric}
              score={scores[metric.key]}
              isNew={isNew && scores[metric.key] !== null}
            />
          ))}
        </div>

        {roundCount > 0 && (
          <div className="scores-footer">
            <span>Round {roundCount}</span>
            <span className="scores-footer-dot">·</span>
            <span>Last updated</span>
          </div>
        )}
      </div>
    </aside>
  );
}