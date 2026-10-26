// Bundled snapshot of the Renderful models the Asset Builder allows, used only when
// the live `/models` catalog cannot be fetched. Costs are USD min–max ranges from
// https://api.renderful.ai/api/v1/models (verified 2026-10-26). The live catalog wins.
export const FALLBACK_MODELS = [
  { id: "flux-dev", name: "FLUX.1 Dev", type: "text-to-image", cost: { min: 0.025, max: 0.1 } },
  { id: "flux-schnell", name: "FLUX.1 Schnell", type: "text-to-image", cost: { min: 0.003, max: 0.012 } },
  { id: "seedream-4.5", name: "Seedream 4.5", type: "text-to-image", cost: { min: 0.04, max: 0.16 } },
  { id: "gpt-image-2", name: "GPT Image 2", type: "text-to-image", cost: { min: 0.03, max: 0.12 } },

  { id: "speech-2.6-turbo", name: "MiniMax Speech 2.6 Turbo", type: "text-to-audio", cost: { min: 0.06, max: 0.24 } },
  { id: "eleven_v3", name: "ElevenLabs v3", type: "text-to-audio", cost: { min: 0.1, max: 0.4 } },
  { id: "music-2.5", name: "MiniMax Music 2.5", type: "text-to-music", cost: { min: 0.15, max: 0.6 } },

  { id: "hunyuan3d-v3", name: "Hunyuan3D v3 (text→3D)", type: "text-to-3d", cost: { min: 0.375, max: 1.5 } },
  { id: "hunyuan3d-v3-i2-3d", name: "Hunyuan3D v3 (image→3D)", type: "image-to-3d", cost: { min: 0.375, max: 1.5 } },
  { id: "hunyuan3d-v2.1", name: "Hunyuan3D v2.1", type: "image-to-3d", cost: { min: 0.3, max: 1.2 } },
  { id: "hunyuan3d-v2-multi-view", name: "Hunyuan3D v2 multi-view", type: "image-to-3d", cost: { min: 0.03, max: 0.12 } },

  { id: "seedance-1.5-pro", name: "Seedance 1.5 Pro", type: "text-to-video", cost: { min: 0.13, max: 0.26 } },
  { id: "seedance-1.5-pro-i2v", name: "Seedance 1.5 Pro I2V", type: "image-to-video", cost: { min: 0.15, max: 0.3 } },
  { id: "hailuo-2.3", name: "Hailuo 2.3", type: "text-to-video", cost: { min: 0.28, max: 0.56 } },
  { id: "hailuo-2.3-i2v", name: "Hailuo 2.3 I2V", type: "image-to-video", cost: { min: 0.25, max: 0.5 } },
  { id: "sora-2", name: "Sora 2", type: "text-to-video", cost: { min: 0.44, max: 0.88 } },
  { id: "kling-v3", name: "Kling v3", type: "text-to-video", cost: { min: 0.42, max: 0.84 } },
  { id: "kling-v3", name: "Kling v3 I2V", type: "image-to-video", cost: { min: 0.42, max: 0.84 } },
  { id: "wan-2.6", name: "Wan 2.6 T2V", type: "text-to-video", cost: { min: 0.5, max: 1 } },
  { id: "wan-2.6-i2v", name: "Wan 2.6 I2V", type: "image-to-video", cost: { min: 0.5, max: 1 } },
  { id: "wan-2.7-t2v", name: "Wan 2.7 T2V", type: "text-to-video", cost: { min: 0.45, max: 0.9 } },
  { id: "wan-2.7-i2v", name: "Wan 2.7 I2V", type: "image-to-video", cost: { min: 0.45, max: 0.9 } },
  { id: "google-veo-3.1-fast", name: "Veo 3.1 Fast", type: "text-to-video", cost: { min: 1.06, max: 2.12 } },
  { id: "google-veo-3.1", name: "Veo 3.1", type: "text-to-video", cost: { min: 2.82, max: 5.64 } }
];
