---
name: evaluapro-reactivo-review
description: Create, audit, import, or revise automatically gradable EvaluaPro question-bank items with source traceability, one canonical topic each, verified answer keys, and plausible distractors. Use before exam blueprint preview or publication.
---

# EvaluaPro reactivo authoring and review

Create questions only for taught outcomes in the accepted blueprint. Use EvaluaPro's canonical bank/API or its documented import contract; do not inject directly into SQLite or the legacy bank. Read `docs/specs/SPEC-061_banco_reactivos_ia_versionado.spec.md` and, for XLSX, `docs/contracts/reactivos-xlsx.v1.md` before producing a payload.

## Authoring constraints

- Use the scoring format requested and supported by the target template. For current OMR, use exactly five ordered options A–E and exactly one correct answer.
- Give every item one canonical `temaId`, one observable outcome, and source provenance. If a batch covers multiple themes, set `temaId` per item; do not copy the whole theme list to every item.
- Ask one unambiguous question. Include necessary data and units; define assumptions. Avoid accidental clues, double negatives, “all/none of the above,” overlapping answers, and irrelevant reading load.
- Make all distractors plausible for a learner with a specific misconception or reasoning error. Keep options parallel in grammar, specificity, units, and approximate length. Never make the key conspicuously longer or more qualified.
- Difficulty metadata is a hypothesis until calibrated from valid, persisted student responses. Do not present a generated label as measured difficulty or psychometric evidence.

## Verify every item independently

For each stem, identify its source activity/outcome and solve it independently before checking the proposed key. For calculations, show the equation, substitute the given values, carry units, and test rounding/boundary assumptions. For interpretation/cases, cite the evidence that makes the key uniquely defensible. Then inspect each distractor: why it could attract a misconception, why it is wrong under the stated facts, and whether a knowledgeable learner could reasonably defend it. Reject or rewrite any item with multiple defensible keys, missing assumptions, unsupported facts, ambiguous theme, or an obvious giveaway.

Review the complete exam set too: topic balance, repeated stems/keys, answer-position pattern, cognitive-level coverage, redundancy, and source gaps. Balance answer positions only after correctness is fixed; never alter a correct key to force a distribution.

## EvaluaPro lifecycle

1. Generate/import a draft batch with stable `externalKey`, canonical IDs, provenance, and `temaId` per item.
2. Run read-only preview. Inspect every row, topic, conflict, version, answer, and content hash; revise and preview again after any change.
3. Confirm the exact reviewed `planHash` and payload. Handle version conflicts explicitly; never overwrite a published version.
4. Move drafts to review, perform the independent content check, then publish explicitly. Confirm the published version and its topic before including it in a template blueprint.
5. Preserve source-to-item and item-version-to-blueprint traceability. Keep student PII out of provenance and logs.

## Rejection conditions

Do not publish items with unchecked answer keys, unsupported content, unsafe markup/remote assets, missing/mismatched canonical IDs, multiple correct answers, low-quality distractors, unscorable response types, or ambiguous topic mapping. Report which rows failed and the minimum correction needed.
