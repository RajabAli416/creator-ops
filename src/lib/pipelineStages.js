/** Option A — automation-aligned pipeline stages. */

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

export const PIPELINE_STAGES = [
  {
    id: PIPELINE_PLANNED,
    label: 'Planned',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    description: 'Idea or brief — not in production yet',
  },
  {
    id: PIPELINE_IN_PRODUCTION,
    label: 'In production',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    description: 'Drive folder linked — team is working on the video',
  },
  {
    id: PIPELINE_READY,
    label: 'Ready to publish',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    description: 'Final video detected in Drive',
  },
  {
    id: PIPELINE_PUBLISHED,
    label: 'Published',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    description: 'Live on YouTube',
  },
];
