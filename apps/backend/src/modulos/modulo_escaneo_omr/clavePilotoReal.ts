import type { OpcionOmr } from './porFolioDataset.js';

export function normalizarClavePilotoReal(value: unknown, label = 'answerKey'): Record<string, OpcionOmr> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} debe ser un objeto pregunta-opción explícito.`);
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) throw new Error(`${label} debe incluir una clave explícita no vacía.`);
  const answerKey: Record<string, OpcionOmr> = {};
  for (const [questionNumberRaw, optionRaw] of entries) {
    const questionNumber = Number(questionNumberRaw);
    const option = String(optionRaw ?? '').trim().toUpperCase();
    if (!Number.isSafeInteger(questionNumber) || questionNumber <= 0 || !['A', 'B', 'C', 'D', 'E'].includes(option)) {
      throw new Error(`${label} contiene una entrada inválida en la pregunta ${questionNumberRaw}.`);
    }
    answerKey[String(questionNumber)] = option as OpcionOmr;
  }
  const questionNumbers = Object.keys(answerKey).map(Number).sort((a, b) => a - b);
  if (questionNumbers.some((questionNumber, index) => questionNumber !== index + 1)) {
    throw new Error(`${label} debe cubrir preguntas consecutivas desde 1.`);
  }
  return Object.fromEntries(Object.entries(answerKey).sort((a, b) => Number(a[0]) - Number(b[0])));
}
