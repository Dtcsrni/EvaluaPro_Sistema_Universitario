import { Schema, model, models } from 'mongoose';

const OmrSheetFamilySchema = new Schema(
  {
    familyCode: { type: String, required: true, unique: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    status: { type: String, enum: ['draft', 'active', 'retired'], default: 'active' },
    pageFormat: { type: String, enum: ['letter'], default: 'letter' },
    questionCapacity: { type: Number, required: true, min: 1 },
    choiceCountMax: { type: Number, required: true, min: 2, max: 10 },
    studentIdDigits: { type: Number, required: true, min: 0, max: 12 },
    versionBubbleCount: { type: Number, required: true, min: 1, max: 12 },
    supportsPrefill: { type: Boolean, default: true },
    supportsBlankGeneric: { type: Boolean, default: true },
    geometryDefaults: { type: Schema.Types.Mixed, required: true },
    printSpec: { type: Schema.Types.Mixed, required: true },
    scanSpec: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true, collection: 'omrSheetFamilies' }
);

export const OmrSheetFamily = models.OmrSheetFamily ?? model('OmrSheetFamily', OmrSheetFamilySchema);
