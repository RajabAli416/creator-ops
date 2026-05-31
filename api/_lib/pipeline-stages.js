/** Option A — automation-aligned pipeline stages (API copy). */

export const PIPELINE_PLANNED = 'planned';
export const PIPELINE_IN_PRODUCTION = 'in_production';
export const PIPELINE_READY = 'ready_to_publish';
export const PIPELINE_PUBLISHED = 'published';

const LEGACY_STAGE_MAP = {
  idea: PIPELINE_PLANNED,
  script: PIPELINE_PLANNED,
  recording: PIPELINE_PLANNED,
  editing: PIPELINE_IN_PRODUCTION,
  thumbnail: PIPELINE_IN_PRODUCTION,
  review: PIPELINE_READY,
  scheduled: PIPELINE_READY,
};

export function normalizePipelineStage(stage) {
  if (!stage) return PIPELINE_PLANNED;
  if (LEGACY_STAGE_MAP[stage]) return LEGACY_STAGE_MAP[stage];
  if (
    stage === PIPELINE_PLANNED ||
    stage === PIPELINE_IN_PRODUCTION ||
    stage === PIPELINE_READY ||
    stage === PIPELINE_PUBLISHED
  ) {
    return stage;
  }
  return PIPELINE_PLANNED;
}

export function pipelineStageToDbStatus(stage) {
  const normalized = normalizePipelineStage(stage);
  if (normalized === PIPELINE_PUBLISHED) return 'published';
  if (stage === 'archived') return 'archived';
  return 'draft';
}

/** Stages that auto-create a Drive folder when missing (if enabled). */
export const AUTO_FOLDER_STAGES = new Set([PIPELINE_PLANNED, PIPELINE_IN_PRODUCTION]);
