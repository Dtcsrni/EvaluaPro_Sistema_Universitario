---
name: evaluapro-exam-batch-qa
description: Preview, generate, recover, and verify EvaluaPro OMR batch PDFs and per-student ZIPs for printing. Use when a batch needs template/layout QA, delivery, recovery, or print-readiness checks.
---

# EvaluaPro exam batch and print QA

Generate only through EvaluaPro. Read `docs/specs/SPEC-068_generacion_lotes_pdf_integridad.spec.md`, `docs/specs/SPEC-083_flujo_prevalidacion_lotes_pdf.spec.md` when present, and the active template rules. Keep the approved production path; do not create/repair the final PDF or ZIP using a parallel renderer or alter the printed artifact outside EvaluaPro.

## Global, OMR, OCR, and QR readiness

- For a Global, confirm the selected template is explicitly approved for Global and matches the approved coverage blueprint; a partial template or a Global gradebook field does not establish that. If the UI catalog has no suitable Global template, stop before “Crear plantilla”, generation, or persistence and report the missing decision/template.
- Read the OMR policy from the same source/runtime version as the app under review. Confirm policy ID, contract ID, template version/wire marker, and the template stored with the preview. Do not hardcode a historical version; at v1.2.13 the policy/UI showed canonical v4 / `TV4`.
- Inspect QR association independently: signed payload, folio, page number, exam ID when present, registered page map, and verified source PDF must agree uniquely. QR geometry recovery may restore identity when direct decode fails; record the recovery warning and do not rotate that recovered image before answer reading.
- Treat OCR as a review suggestion only. In particular, `OMR_OCR_IDENTIDAD_SUGERIDA` cannot establish student identity, bind a page automatically, select an answer, or authorize a grade. Preserve original page and route uncertainty/mismatch to human review. OMR reads answers from the original page against the matching template geometry; QR identity and OMR answer interpretation are separate analyses.
- A flow review may inspect catalog, configuration, form fields, and read-only previews. Do not submit “Crear plantilla”, persist a blueprint, start a lot, or click final generation unless the user has authorized that mutation. A preview is not a generated artifact and does not reserve a folio/lot.

## Before generation

- Verify approved/published item versions, exact topic coverage, answer keys, template ownership, active template status, OMR version, maximum page count, roster count, identity format, and print constraints.
- Run a fresh template preview. Confirm every selected item/version is frozen in the blueprint, no stale-bank warning remains, all questions fit at a readable uniform font, pages share one paper size, and staple/handwriting/QR/fiducial/bubble zones do not overlap.
- Confirm QR/fiducial/bubble geometry from the current rendered preview and version-matched policy; a UI badge that says OMR is active does not prove the generated pages or later scans use that contract.
- Confirm the requested page budget is per student versus consolidated lot. Enforce per-exam limits; do not confuse 12 four-page exams (48 consolidated pages) with a 48-page individual exam.
- Use a stable batch ID and record the exact template/blueprint fingerprint before generation.
- For the requested standard profile of 12 students, target two Letter/Carta pages per student, duplex printing, one 24-page consolidated PDF, and one ZIP containing exactly 12 separate two-page PDFs. Derive the actual cohort and page budget from the user's request; these sample quantities are not defaults for unrelated courses.
- Fit the greatest number of approved questions that remains readable. Start from the current template typography and reduce it by only one available step; inspect the rendered Carta pages at actual print scale. Reject any setting with cramped glyphs, collisions, clipped content, or lost OMR clearances. Do not keep shrinking text to force more questions; report the maximum readable count if it does not fit.
- Keep the printed exam title to the requested partial name (for example, `Primer Parcial`). Do not append subject, group, student count, or question count to that visible title. Give individual ZIP entries distinct, safe filenames based on a stable folio or approved student label, not ambiguous duplicate names.

## Generate and recover

- Follow persisted lot states: `iniciando`, `generando`, `validando`, `completado` or `fallido`. Partial or uncertain state is not ready to download.
- On recoverable failure, inspect the existing lot and resume that same ID. Preserve student-to-folio mapping. Do not reissue identifiers or silently create a duplicate batch.
- Do not offer the consolidated PDF until every expected student exam exists and passes validation. If the system exposes a failure, retain evidence and stop rather than bypassing it.
- Produce both requested formats from the same prevalidated per-student PDFs and frozen roster/blueprint. The consolidated PDF contains those exams once in the approved roster order; the ZIP contains one two-page PDF per student, with matching folio and question variant. Do not rerender for the ZIP or split pages by position alone if persisted exam/folio metadata can establish the mapping.
- Verify the ZIP is an actual archive by checking its response MIME type, opening the archive, and confirming exactly the expected student files, two Carta pages per file, unique names, and no extra/partial files. The UI label “ZIP / PDF” is not evidence. If the current API only returns `application/pdf` or no verified ZIP route exists, report the capability gap and stop before claiming the ZIP deliverable; request authorization for a product change if implementation is needed.

## Acceptance checks

Verify actual generated bytes, not only UI success text:

- Each exam: expected item set exactly once, correct order/map/QR association, uniform actual page count within configured maximum, paper size on every page, legible type, identity placement outside the handwritten-name field, and no collision with protected OMR/staple geometry.
- For scan-readiness, use an actual captured/scanned sample only when authorized and available. Verify QR match/recovery and OMR answers separately; OCR identity suggestions remain unresolved until human confirmation. Synthetic unit fixtures or UI badges do not establish physical scan quality.
- Consolidated lot: expected exam count, stable roster order, pages equal `students × uniform pages per exam`, matching persisted SHA-256 and counts, and no partial/duplicate exams.
- Cross-deliverables: reconcile every expected folio between the consolidated PDF and ZIP members; confirm each ZIP member is the same validated per-student exam used in the consolidated lot, and neither package omits or duplicates a student.
- Download: authenticate/refresh as supported, compare downloaded hash and byte count to the completed lot, then verify the browser opened the same artifact. Distinguish automated headless Edge, visible browser inspection, physical printing, and actual printed copies; never claim a later stage from an earlier one.
- Preserve the original valid artifact during diagnosis. Use synthetic QA PDFs for browser regression; never substitute a synthetic fixture for verifying the user's real batch.

## Final handoff

Report the EvaluaPro lot ID, PDF and ZIP locations, student/file counts, pages per exam, consolidated page count, hashes/integrity checks, and any physical/browser validation not performed. Link only artifacts actually verified. Do not say “ready to print” if legibility, package integrity, or layout gates are unresolved.
