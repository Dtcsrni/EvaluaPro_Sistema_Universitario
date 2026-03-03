import { FAMILIAS_OMR_V1 } from './familiasOmrV1';
import { OmrSheetFamily } from './modeloOmrSheetFamily';
import { OmrSheetRevision } from './modeloOmrSheetRevision';

export async function seedFamiliasOmrV1() {
  for (const family of Object.values(FAMILIAS_OMR_V1)) {
    const familyDoc = await OmrSheetFamily.findOneAndUpdate(
      { familyCode: family.familyCode },
      { $set: family },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    await OmrSheetRevision.findOneAndUpdate(
      { familyId: familyDoc._id, revision: 1 },
      {
        $set: {
          geometry: family.geometryDefaults,
          qualityThresholds: {
            globalConfidenceMin: 0.92,
            markConfidenceMin: 0.82,
            idDigitConfidenceMin: 0.9,
            versionConfidenceMin: 0.9
          },
          renderTemplateVersion: 1,
          recognitionEngineVersion: 1,
          isActive: true
        }
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  }
}
