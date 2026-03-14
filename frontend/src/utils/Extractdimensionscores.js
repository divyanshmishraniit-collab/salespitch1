/**
 * extractDimensionScores(text)
 *
 * Scans AI feedback text for the 5 scoring dimensions:
 *   tone, communication, content, queryHandling, closure
 *
 * The backend prompt will be updated to include these. This parser
 * handles multiple formats so it degrades gracefully:
 *
 *   "Tone: 8/10"
 *   "**Tone:** 8"
 *   "Tone Score: 8/10"
 *   "- Tone: 8"
 *
 * Returns an object with null for any dimension not found.
 */

const DIMENSION_PATTERNS = [
  {
    key: 'tone',
    re: /\bTone(?:\s+Score)?[:\s*]+(\d+(?:\.\d+)?)\s*(?:\/\s*10)?/i,
  },
  {
    key: 'communication',
    re: /\bCommunication(?:\s+Score)?[:\s*]+(\d+(?:\.\d+)?)\s*(?:\/\s*10)?/i,
  },
  {
    key: 'content',
    re: /\bContent(?:\s+Score)?[:\s*]+(\d+(?:\.\d+)?)\s*(?:\/\s*10)?/i,
  },
  {
    key: 'queryHandling',
    re: /\bQuery\s+Handling(?:\s+Score)?[:\s*]+(\d+(?:\.\d+)?)\s*(?:\/\s*10)?/i,
  },
  {
    key: 'closure',
    re: /\bClosure(?:\s+Score)?[:\s*]+(\d+(?:\.\d+)?)\s*(?:\/\s*10)?/i,
  },
];

export function extractDimensionScores(text) {
  if (!text) return nullScores();

  const result = {};
  let found = false;

  for (const { key, re } of DIMENSION_PATTERNS) {
    const match = re.exec(text);
    if (match) {
      const val = parseFloat(match[1]);
      // Clamp to 1–10 range
      result[key] = Math.min(10, Math.max(0, val));
      found = true;
    } else {
      result[key] = null;
    }
  }

  return found ? result : nullScores();
}

function nullScores() {
  return {
    tone: null,
    communication: null,
    content: null,
    queryHandling: null,
    closure: null,
  };
}

export { nullScores };