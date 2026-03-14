/**
 * parseAIResponse(text)
 *
 * Detects sections in the AI's raw text response and splits them into
 * typed blocks that can be rendered distinctly in the UI.
 *
 * Supported section types:
 *  - 'score'         — e.g. "Score: 7/10" or "Effectiveness: 75%"
 *  - 'strengths'     — bullet list of positives
 *  - 'improvements'  — bullet list of areas to improve
 *  - 'critical'      — a single challenging / critical question for the rep
 *  - 'question'      — any ask / question from the AI, shown in a colored box at the end
 *  - 'summary'       — general summary / opening paragraph
 *  - 'text'          — fallback plain text block
 */

// Heading patterns → section type
const SECTION_PATTERNS = [
  { type: 'strengths',    re: /^(strengths?|what\s+worked|positives?|good\s+points?|well\s+done)/i },
  { type: 'improvements', re: /^(improvements?|areas?\s+(to\s+)?(improve|work\s+on)|suggestions?|to\s+strengthen|weaknesses?|could\s+be\s+better)/i },
  { type: 'critical',     re: /^(critical\s+question|challenging\s+question|tough\s+question|hard\s+question|key\s+question|probing\s+question|objection|challenge)/i },
  { type: 'summary',      re: /^(summary|overview|overall|assessment|evaluation|pitch\s+analysis|analysis)/i },
  { type: 'score',        re: /^(score|rating|effectiveness|effectiveness\s+score|pitch\s+score)/i },
  { type: 'question',     re: /^(questions?|ask|my\s+question|follow[\s-]?up|i\s+want\s+to\s+ask|please\s+(answer|respond|tell)|can\s+you\s+(tell|explain|describe|clarify)|what\s+(is|are|do|does|would)|how\s+(do|does|would|can|should)|why\s+(do|does|did|is|are|would)|when\s+(do|does|did|is|are|would)|who\s+(is|are|does|did|would)|do\s+you\s+|does\s+your\s+|would\s+you\s+|could\s+you\s+|tell\s+me)/i },
];

// Inline score pattern — "Score: 7/10" anywhere in the first 3 lines
const INLINE_SCORE_RE = /(?:score|rating|effectiveness)[:\s]+(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+)|%)?/i;

// Detects a standalone question line — a full line that is itself a question
// Handles quoted questions like "How do you...?" and plain ones like How do you...?
const STANDALONE_QUESTION_RE = /^["'"']?([A-Z].{10,}[?]["'"']?)["'"']?$/;

function isQuestionLine(line) {
  const t = line.trim();
  if (!t) return false;
  // Strip surrounding quotes then check ends with ?
  const stripped = t.replace(/^["'"'\u201C\u201D]+|["'"'\u201C\u201D]+$/g, '').trim();
  return stripped.endsWith('?') && stripped.length > 10;
}

function detectHeadingType(line) {
  const clean = line.replace(/^#+\s*/, '').replace(/[:*_]/g, '').trim();
  for (const { type, re } of SECTION_PATTERNS) {
    if (re.test(clean)) return type;
  }
  return null;
}

function isBullet(line) {
  return /^[\-\*\•\–]\s+/.test(line.trim()) || /^\d+\.\s+/.test(line.trim());
}

function stripBullet(line) {
  return line.trim().replace(/^[\-\*\•\–\d]+\.?\s+/, '');
}

function isHeading(line) {
  return /^#{1,4}\s+/.test(line) || /^[A-Z][^a-z]{0,30}:$/.test(line.trim()) || /^\*\*[^*]+\*\*:?\s*$/.test(line.trim());
}

/**
 * Scan ANY text/summary/text block for embedded question sentences and
 * pull them out, returning { cleaned: string, questions: string[] }
 */
function extractQuestionsFromText(content) {
  if (!content) return { cleaned: content, questions: [] };

  // Split by sentence boundaries (after . ! ?) or by newlines
  const parts = content.split(/\n/);
  const questions = [];
  const rest = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) { rest.push(part); continue; }

    // Check if the whole line is a question (standalone quoted or plain)
    if (isQuestionLine(trimmed)) {
      // Strip surrounding quotes for clean storage
      const clean = trimmed.replace(/^["'"'\u201C\u201D]+|["'"'\u201C\u201D]+$/g, '').trim();
      questions.push(clean);
      continue;
    }

    // Check sentence-by-sentence within the line
    const sentences = trimmed.split(/(?<=[.!?])\s+/);
    const keepSentences = [];
    for (const s of sentences) {
      const sc = s.replace(/^["'"'\u201C\u201D]+|["'"'\u201C\u201D]+$/g, '').trim();
      if (sc.endsWith('?') && sc.length > 10) {
        questions.push(sc);
      } else {
        keepSentences.push(s);
      }
    }
    const remaining = keepSentences.join(' ').trim();
    if (remaining) rest.push(remaining);
  }

  return {
    cleaned: rest.join('\n').trim(),
    questions,
  };
}

export function parseAIResponse(raw) {
  if (!raw || !raw.trim()) return [{ type: 'text', content: '' }];

  const lines = raw.split('\n');
  const blocks = [];

  // Check for inline score in the first 4 lines
  const previewText = lines.slice(0, 4).join(' ');
  const scoreMatch = INLINE_SCORE_RE.exec(previewText);
  if (scoreMatch) {
    const value = parseFloat(scoreMatch[1]);
    const outOf = scoreMatch[2] ? parseFloat(scoreMatch[2]) : (value <= 10 ? 10 : 100);
    blocks.push({ type: 'score', value, outOf });
  }

  let currentType = 'summary';
  let currentLines = [];

  const flush = () => {
    if (!currentLines.length) return;
    const nonEmpty = currentLines.filter(l => l.trim());
    if (!nonEmpty.length) { currentLines = []; return; }

    if (currentType === 'strengths' || currentType === 'improvements') {
      const bullets = nonEmpty
        .filter(l => isBullet(l) || l.trim().length > 0)
        .map(l => isBullet(l) ? stripBullet(l) : l.trim())
        .filter(Boolean);
      if (bullets.length) blocks.push({ type: currentType, items: bullets });

    } else if (currentType === 'score') {
      // Already handled via inline detection; skip

    } else if (currentType === 'critical') {
      const question = nonEmpty
        .map(l => isBullet(l) ? stripBullet(l) : l.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (question) blocks.push({ type: 'critical', question });

    } else if (currentType === 'question') {
      const question = nonEmpty
        .map(l => isBullet(l) ? stripBullet(l) : l.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (question) blocks.push({ type: 'question', question });

    } else {
      const text = nonEmpty
        .map(l => l.replace(/\*\*(.*?)\*\*/g, '$1').trim())
        .join('\n')
        .trim();
      if (text) blocks.push({ type: currentType, content: text });
    }

    currentLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      currentLines.push('');
      continue;
    }

    if (isHeading(trimmed)) {
      flush();
      const detectedType = detectHeadingType(trimmed);
      if (detectedType === 'score') {
        currentType = 'score';
      } else {
        currentType = detectedType || 'text';
      }
      continue;
    }

    // Detect inline heading pattern like "Critical Question: ..." or "Question: ..."
    const inlineHeadingMatch = trimmed.match(/^(\*{0,2})([A-Z][^:*\n]{2,40})\1\s*:\s*(.+)$/);
    if (inlineHeadingMatch) {
      const headingText = inlineHeadingMatch[2];
      const rest = inlineHeadingMatch[3];
      const detectedType = detectHeadingType(headingText);
      if (detectedType && detectedType !== 'score') {
        flush();
        currentType = detectedType;
        currentLines.push(rest);
        continue;
      }
    }

    // ── Key fix: detect standalone question lines mid-stream ──
    // If current section is text/summary and this line looks like a question, flush
    // and immediately push a question block, then resume previous type.
    if (
      (currentType === 'text' || currentType === 'summary') &&
      isQuestionLine(trimmed)
    ) {
      flush();
      const clean = trimmed.replace(/^["'"'\u201C\u201D]+|["'"'\u201C\u201D]+$/g, '').trim();
      blocks.push({ type: 'question', question: clean });
      // Don't change currentType — continue accumulating text after this line
      continue;
    }

    currentLines.push(line);
  }

  flush();

  // ── Post-processing: extract embedded questions from ALL text/summary blocks ──
  const extractedQuestions = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if ((b.type === 'text' || b.type === 'summary') && b.content) {
      const { cleaned, questions } = extractQuestionsFromText(b.content);
      if (questions.length > 0) {
        extractedQuestions.push(...questions);
        b.content = cleaned;
        if (!b.content) {
          blocks.splice(i, 1);
          i--;
        }
      }
    }
  }
  // Add all extracted questions as a single merged question block
  if (extractedQuestions.length > 0) {
    blocks.push({ type: 'question', question: extractedQuestions.join(' ') });
  }

  // If nothing was parsed (no headings), return as plain text blocks
  if (blocks.length === 0 || (blocks.length === 1 && blocks[0].type === 'score')) {
    const text = raw.replace(/\*\*(.*?)\*\*/g, '$1').trim();
    blocks.push({ type: 'text', content: text });
  }

  // Deduplicate critical blocks — keep only the last one
  const criticalIndices = blocks.map((b, i) => b.type === 'critical' ? i : -1).filter(i => i !== -1);
  if (criticalIndices.length > 1) {
    const toRemove = new Set(criticalIndices.slice(0, -1));
    return blocks.filter((_, i) => !toRemove.has(i));
  }

  // Merge all question blocks into one and move to the very end
  const questionBlocks = blocks.filter(b => b.type === 'question');
  const nonQuestionBlocks = blocks.filter(b => b.type !== 'question');

  if (questionBlocks.length > 0) {
    const mergedQuestion = questionBlocks.map(b => b.question).join(' ');
    return [...nonQuestionBlocks, { type: 'question', question: mergedQuestion }];
  }

  return nonQuestionBlocks;
}