import { Schema, model, models } from 'mongoose';

const OmrExceptionSchema = new Schema(
  {
    code: { type: String, required: true },
    severity: { type: String, enum: ['info', 'warning', 'blocking'], required: true },
    message: { type: String, required: true },
    region: { type: String },
    candidateValues: [{ type: String }],
    recommendedAction: { type: String }
  },
  { _id: false }
);

const OmrScanPageResultSchema = new Schema(
  {
    sheetSerial: { type: String, required: true, trim: true },
    pageIndex: { type: Number, required: true, min: 1 },
    sourceFingerprint: { type: String, required: true },
    qualityMetrics: { type: Schema.Types.Mixed, default: {} },
    qrResult: { type: Schema.Types.Mixed, default: {} },
    anchorResult: { type: Schema.Types.Mixed, default: {} },
    identityResult: { type: Schema.Types.Mixed, default: {} },
    versionResult: { type: Schema.Types.Mixed, default: {} },
    responses: { type: Schema.Types.Mixed, default: [] },
    scanStatus: { type: String, enum: ['accepted', 'needs_review', 'rejected'], required: true },
    exceptions: { type: [OmrExceptionSchema], default: [] },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    autoGradable: { type: Boolean, default: false },
    scoreResult: { type: Schema.Types.Mixed, default: null },
    manualReviewRequired: { type: Boolean, default: false },
    canonicalizationMetrics: { type: Schema.Types.Mixed, default: {} },
    markMetrics: { type: Schema.Types.Mixed, default: {} },
    resolvedState: { type: Schema.Types.Mixed, default: null },
    canonicalImageArtifact: { type: String },
    debugArtifacts: { type: [String], default: [] }
  },
  { _id: false }
);

const OmrReviewResolutionSchema = new Schema(
  {
    sheetSerial: { type: String, required: true, trim: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    resolvedAt: { type: Date, required: true },
    overrides: { type: Schema.Types.Mixed, default: {} },
    finalResponses: { type: Schema.Types.Mixed, default: [] },
    finalIdentity: { type: Schema.Types.Mixed, default: {} },
    resolvedVersion: { type: Schema.Types.Mixed, default: {} },
    rescoredResult: { type: Schema.Types.Mixed, default: null },
    auditTrail: { type: Schema.Types.Mixed, default: [] },
    resolutionReason: { type: String, trim: true }
  },
  { _id: false }
);

const OmrScanJobSchema = new Schema(
  {
    jobId: { type: String, required: true, unique: true, trim: true },
    sourceType: { type: String, enum: ['pdf', 'image_batch', 'camera_capture'], required: true },
    generatedAssessmentId: { type: Schema.Types.ObjectId, ref: 'ExamenGenerado', required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'Docente', required: true },
    status: { type: String, enum: ['queued', 'processing', 'completed', 'failed', 'finalized'], default: 'queued' },
    pagesTotal: { type: Number, default: 0, min: 0 },
    pagesProcessed: { type: Number, default: 0, min: 0 },
    summary: { type: Schema.Types.Mixed, default: {} },
    artifacts: { type: Schema.Types.Mixed, default: {} },
    pages: { type: [OmrScanPageResultSchema], default: [] },
    reviewResolutions: { type: [OmrReviewResolutionSchema], default: [] }
  },
  { timestamps: true, collection: 'omrScanJobs' }
);

export const OmrScanJob = models.OmrScanJob ?? model('OmrScanJob', OmrScanJobSchema);
