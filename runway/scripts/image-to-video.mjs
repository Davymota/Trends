// Imagem → vídeo.
//   npm run video -- ./out/image-xxxx.png "câmera lenta sobre a floresta, folhas ao vento" \
//                    [--model gen4_turbo] [--duration 5] [--ratio 1280:720] [--seed 7] [--budget 60]
//
// Modelos e o que muda entre eles (todos aceitam promptImage como URL ou upload):
//   gen4_turbo   (padrão) 5 ou 10 s, 720p; melhor custo por segundo da família Gen-4
//   gen4.5       2 a 10 s; mais fiel ao prompt e com saídas ProRes/HDR; custa mais
//   veo3.1_fast  4/6/8 s, gera ÁUDIO junto (--audio); veo3.1 é a versão cara
//   seedance2_mini / seedance2_fast / seedance2  do mais barato ao mais caro; aceitam --audio
//   hailuo3, wan3, happyhorse_1_0, grok_imagine_1_5 ...
// Ratios e parâmetros válidos por modelo: node_modules/@runwayml/sdk/resources/image-to-video.d.ts

import { makeClient, parseArgs, budgetFrom, resolveAsset, runWithBudget, saveOutputs } from '../lib/client.mjs';

const { flags, positional } = parseArgs();
const [imageRef, ...rest] = positional;
const promptText = rest.join(' ').trim();
if (!imageRef) {
  console.error('uso: npm run video -- <imagem.png|url> "prompt de movimento" [--model m] [--duration s] [--budget n]');
  process.exit(1);
}

const client = makeClient();
const model = flags.model ?? 'gen4_turbo';
const duration = Number(flags.duration ?? 5);
const ratio = flags.ratio ?? '1280:720';

const body = {
  model,
  promptImage: await resolveAsset(client, imageRef),
  ratio,
  duration,
};
if (promptText) body.promptText = promptText;
if (flags.seed) body.seed = Number(flags.seed);
if (flags.audio) body.audio = true;

console.log(`modelo ${model} · ${duration}s · ratio ${ratio} · orçamento ${budgetFrom(flags)} créditos`);
const done = await runWithBudget(client, client.imageToVideo.create(body), budgetFrom(flags));
await saveOutputs(done, 'video');
