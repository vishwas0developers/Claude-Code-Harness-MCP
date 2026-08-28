// Rule-based classifier: keyword signals only, matching the "classification rule of
// thumb" documented in README.md. No LLM fallback — ponytail: a fast, deterministic,
// auditable first pass is enough for this harness's actual need; add an LLM fallback
// classifier only if false-negatives on ambiguous tasks turn out to matter in practice.

const DESIGN_KEYWORDS = [
  "ui", "ux", "layout", "css", "scss", "style", "styling", "color", "colour",
  "animation", "responsive", "typography", "font", "icon", "visual design",
  "component visual", "design system", "theme", "spacing", "wireframe", "mockup",
];

const LOGIC_KEYWORDS = [
  "algorithm", "api", "database", "db", "auth", "authentication", "authorization",
  "state management", "business logic", "backend", "data processing", "bug",
  "fix", "function", "performance", "optimi", "test coverage", "unit test",
  "endpoint", "query", "schema", "migration", "validation", "parser", "cache",
  "concurrency", "security", "refactor", "controller", "service", "handler",
];

export type Classification = "DESIGN_UI" | "LOGIC_BACKEND" | "AMBIGUOUS";

export interface ClassificationResult {
  classification: Classification;
  confidence: number;
  matchedDesignKeywords: string[];
  matchedLogicKeywords: string[];
}

export function classifyTask(taskDescription: string): ClassificationResult {
  const text = taskDescription.toLowerCase();

  const matchedDesignKeywords = DESIGN_KEYWORDS.filter((k) => text.includes(k));
  const matchedLogicKeywords = LOGIC_KEYWORDS.filter((k) => text.includes(k));

  const designScore = matchedDesignKeywords.length;
  const logicScore = matchedLogicKeywords.length;

  if (logicScore === 0 && designScore === 0) {
    return { classification: "AMBIGUOUS", confidence: 0, matchedDesignKeywords, matchedLogicKeywords };
  }

  if (logicScore > designScore) {
    const confidence = logicScore / (logicScore + designScore);
    return { classification: "LOGIC_BACKEND", confidence, matchedDesignKeywords, matchedLogicKeywords };
  }

  if (designScore > logicScore) {
    const confidence = designScore / (logicScore + designScore);
    return { classification: "DESIGN_UI", confidence, matchedDesignKeywords, matchedLogicKeywords };
  }

  // Tied signals: per the PRD, default an ambiguous mixed task to LOGIC_BACKEND only
  // when functional signals are present at all — here they're equal, so treat as
  // ambiguous rather than guessing.
  return { classification: "AMBIGUOUS", confidence: 0.5, matchedDesignKeywords, matchedLogicKeywords };
}

// Difficulty scorer -> Sonnet/Opus router. Configurable thresholds would live in the
// harness config; ponytail: only two bands are needed today, so two constants are
// clearer than a config-driven thresholds file nobody has asked to tune yet.
const HIGH_COMPLEXITY_SIGNALS = [
  "architecture", "multi-file", "multi file", "security-critical", "security critical",
  "concurrency", "race condition", "distributed", "migration", "refactor the",
  "across the codebase", "breaking change",
];

export function scoreDifficulty(taskDescription: string): "sonnet" | "opus" {
  const text = taskDescription.toLowerCase();
  const isHighComplexity =
    HIGH_COMPLEXITY_SIGNALS.some((s) => text.includes(s)) || taskDescription.length > 600;
  return isHighComplexity ? "opus" : "sonnet";
}
