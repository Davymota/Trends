// Texto → imagem.
//   npm run image -- "uma ilha isométrica em ilustração flat" [--model gen4_image] [--ratio 1920:1080]
//                    [--ref caminho-ou-url ...] [--seed 7] [--budget 10]
//
// Modelos aceitos por este script e o mínimo que cada um exige:
//   gen4_image        (padrão) sem referência obrigatória; 720p/1080p
//   gen4_image_turbo  mais barato e rápido, mas EXIGE ao menos um --ref
//   gemini_2.5_flash  bom para variações rápidas; ratios 1024:1024, 1344:768...
//   seedream5_lite / seedream5_pro, gpt_image_2, gemini_image3_pro, muse_image ...
// A lista completa e os ratios válidos de cada um estão nos tipos do SDK:
//   node_modules/@runwayml/sdk/resources/text-to-image.d.ts

import { makeClient, parseArgs, budgetFrom, resolveAsset, runWithBudget, saveOutputs } from '../lib/client.mjs';

const { flags, positional } = parseArgs();
const promptText = positional.join(' ').trim();
if (!promptText) {
  console.error('uso: npm run image -- "prompt" [--model m] [--ratio WxH] [--ref img]... [--budget n]');
  process.exit(1);
}

const client = makeClient();
const model = flags.model ?? 'gen4_image';
const ratio = flags.ratio ?? (model.startsWith('gen4') ? '1920:1080' : '1344:768');
const refs = [].concat(flags.ref ?? []);

const referenceImages = [];
for (const r of refs) referenceImages.push({ uri: await resolveAsset(client, r) });

if (model === 'gen4_image_turbo' && referenceImages.length === 0) {
  console.error('gen4_image_turbo exige pelo menos uma imagem de referência (--ref). Use gen4_image ou passe --ref.');
  process.exit(1);
}

const body = { model, promptText, ratio };
if (referenceImages.length) body.referenceImages = referenceImages;
if (flags.seed) body.seed = Number(flags.seed);

console.log(`modelo ${model} · ratio ${ratio} · orçamento ${budgetFrom(flags)} créditos`);
const done = await runWithBudget(client, client.textToImage.create(body), budgetFrom(flags));
await saveOutputs(done, 'image');
