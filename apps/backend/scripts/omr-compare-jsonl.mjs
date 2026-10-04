#!/usr/bin/env node
import fs from 'node:fs/promises';

const [controlPath, candidatePath] = process.argv.slice(2);
if (!controlPath || !candidatePath) {
  throw new Error('Uso: node omr-compare-jsonl.mjs <control.jsonl> <candidato.jsonl>');
}

async function readJsonl(file) {
  const text = await fs.readFile(file, 'utf8');
  return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${file}:${index + 1}: JSON inválido: ${error.message}`);
    }
  });
}

const [control, candidate] = await Promise.all([
  readJsonl(controlPath),
  readJsonl(candidatePath)
]);
const key = (row) => row.filename;
const indexUnique = (rows, label) => {
  const index = new Map();
  for (const row of rows) {
    if (!row.filename) throw new Error(`${label}: registro sin filename`);
    if (index.has(key(row))) throw new Error(`${label}: filename duplicado: ${row.filename}`);
    index.set(key(row), row);
  }
  return index;
};
const controlByName = indexUnique(control, 'control');
const candidateByName = indexUnique(candidate, 'candidato');
const common = [...controlByName.keys()]
  .filter((filename) => candidateByName.has(filename))
  .map((filename) => [controlByName.get(filename), candidateByName.get(filename)]);

const counts = ['emitted', 'correct', 'wrong', 'blank', 'ambiguous'];
const summarize = (rows) => {
  const successful = rows.filter((row) => !row.error && counts.every((field) => Number.isFinite(row[field])));
  const result = {
    rows: rows.length,
    successful: successful.length,
    failures: rows.length - successful.length,
    ...Object.fromEntries(counts.map((field) => [field, successful.reduce((sum, row) => sum + row[field], 0)]))
  };
  const total = result.correct + result.wrong + result.blank + result.ambiguous;
  result.precision = result.emitted ? result.correct / result.emitted : null;
  result.coverage = total ? result.emitted / total : null;
  result.qrExact = successful.filter((row) => row.qrExact === true).length;
  result.qrUnexpected = successful.filter((row) => row.qrText && row.qrText !== row.sheetId).length;
  return result;
};

const pairIssues = [];
const decisionFields = [...counts, 'analysisState'];
let decisionChanged = 0;
let qrChanged = 0;
let geometryChanged = 0;
for (const [left, right] of common) {
  if (left.sha256 !== right.sha256) pairIssues.push({ filename: left.filename, issue: 'sha256_mismatch' });
  if (decisionFields.some((field) => left[field] !== right[field])) decisionChanged += 1;
  if (left.qrExact !== right.qrExact || left.qrText !== right.qrText || left.qrSource !== right.qrSource) qrChanged += 1;
  if (left.geometryMode !== right.geometryMode || left.geometryReferenceQuality !== right.geometryReferenceQuality) geometryChanged += 1;
  for (const [label, row] of [['control', left], ['candidate', right]]) {
    if (!row.error && counts.every((field) => Number.isFinite(row[field])) &&
        row.emitted + row.blank + row.ambiguous !== 40) {
      pairIssues.push({ filename: row.filename, issue: `${label}_question_count_not_40` });
    }
  }
}

const groupStats = (field) => {
  const values = [...new Set(common.flatMap(([left, right]) => [left[field], right[field]]).filter((value) => value != null))];
  return Object.fromEntries(values.map((value) => {
    const left = common.filter(([row]) => row[field] === value).map(([row]) => row);
    const right = common.filter(([, row]) => row[field] === value).map(([, row]) => row);
    const controlSummary = summarize(left);
    const candidateSummary = summarize(right);
    return [value, {
      control: controlSummary,
      candidate: candidateSummary,
      delta: Object.fromEntries(counts.map((name) => [name, candidateSummary[name] - controlSummary[name]])),
      precisionDelta: candidateSummary.precision == null || controlSummary.precision == null
        ? null
        : candidateSummary.precision - controlSummary.precision,
      coverageDelta: candidateSummary.coverage == null || controlSummary.coverage == null
        ? null
        : candidateSummary.coverage - controlSummary.coverage
    }];
  }));
};

const pairedControl = common.map(([row]) => row);
const pairedCandidate = common.map(([, row]) => row);
const controlSummary = summarize(pairedControl);
const candidateSummary = summarize(pairedCandidate);
const missingInCandidate = [...controlByName.keys()].filter((filename) => !candidateByName.has(filename));
const extraInCandidate = [...candidateByName.keys()].filter((filename) => !controlByName.has(filename));
console.log(JSON.stringify({
  files: { control: controlPath, candidate: candidatePath },
  pairing: {
    controlRows: control.length,
    candidateRows: candidate.length,
    matchedRows: common.length,
    missingInCandidate: { count: missingInCandidate.length, sample: missingInCandidate.slice(0, 5) },
    extraInCandidate: { count: extraInCandidate.length, sample: extraInCandidate.slice(0, 5) },
    sha256Mismatches: pairIssues.filter((issue) => issue.issue === 'sha256_mismatch').length,
    questionCountIssues: pairIssues.filter((issue) => issue.issue.endsWith('_question_count_not_40')).length,
    decisionChanged,
    qrChanged,
    geometryChanged
  },
  inputSummaries: {
    control: summarize(control),
    candidate: summarize(candidate)
  },
  control: controlSummary,
  candidate: candidateSummary,
  delta: Object.fromEntries(counts.map((field) => [field, candidateSummary[field] - controlSummary[field]])),
  precisionDelta: candidateSummary.precision == null || controlSummary.precision == null
    ? null
    : candidateSummary.precision - controlSummary.precision,
  coverageDelta: candidateSummary.coverage == null || controlSummary.coverage == null
    ? null
    : candidateSummary.coverage - controlSummary.coverage,
  byDevice: groupStats('device'),
  byCondition: groupStats('condition'),
  byScenario: groupStats('scenario'),
  pairIssues
}, null, 2));
