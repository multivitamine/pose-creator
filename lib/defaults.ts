export const ASPECT_RATIOS = ['4:5', '1:1', '3:4', '9:16', '5:4', '4:3', '16:9'] as const;
export const RESOLUTIONS = ['1K', '2K', '4K'] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export type Resolution = (typeof RESOLUTIONS)[number];

export const RUNNINGHUB_BASE_URL = 'https://www.runninghub.ai';
export const RUNNINGHUB_UPLOAD_URL = 'https://www.runninghub.cn';

export const SINGLE_DEFAULTS = {
  workflowId: '2054556975387684865',
  promptNodeId: '2',
  promptFieldName: 'text',
  imageNodeId: '3',
  imageFieldName: 'image',
  aspectNodeId: '1',
  aspectFieldName: 'aspectRatio',
  resolutionNodeId: '1',
  resolutionFieldName: 'resolution',
};

export const DOUBLE_DEFAULTS = {
  workflowId: '2054147737213513730',
  promptNodeId: '2',
  promptFieldName: 'text',
  imageNodeId: '7',
  imageFieldName: 'image',
  baseImageNodeId: '3',
  baseImageFieldName: 'image',
  aspectNodeId: '1',
  aspectFieldName: 'aspectRatio',
  resolutionNodeId: '1',
  resolutionFieldName: 'resolution',
};

export const DEFAULT_SINGLE_PROMPT =
  'Fix any imperfections in this mannequin image: bad stance, missing pieces, hair issues, seams, or artifacts. Keep the same pose, body shape, clothing, and overall appearance. Output a clean version of the same mannequin in the same camera framing and background.';

export const DEFAULT_DOUBLE_PROMPT =
  'Use the mannequin as the strict pose reference.\n\nRepose the model to match the mannequin exactly: same body posture, arm and hand placement, leg position, shoulder angle, head angle, body direction, and the position/orientation of the ears and nose.\n\nKeep the model’s identity, face, hair, clothing, body type, and overall appearance unchanged.\n\nThe result should look like the same model photographed naturally in the mannequin’s exact pose.';
