// Texto → vídeo via *Router*: você não escolhe o modelo, a Runway escolhe
// dentro das regras (otimizar por custo, teto de créditos, fallback se lotado).
// É a forma nativa de controlar gasto sem ficar trocando model por model.
//
//   npm run route -- "raposa correndo por uma floresta isométrica" [--duration 5] [--aspect 16:9]
//                    [--resolution 720p] [--max 40] [--optimize cost|latency|quality] [--budget 60]
//
// Na primeira execução o script cria um router chamado `trends-cheap-video`;
// nas seguintes reaproveita. Edite as regras em https://dev.runwayml.com ou aqui.

import { makeClient, parseArgs, budgetFrom, runWithBudget, saveOutputs } from '../lib/client.mjs';

const SLUG = 'trends-cheap-video';

const { flags, positional } = parseArgs();
const promptText = positional.join(' ').trim();
if (!promptText) {
  console.error('uso: npm run route -- "prompt" [--duration s] [--aspect 16:9] [--resolution 720p] [--max créditos]');
  process.exit(1);
}

const client = makeClient();
const maxVideo = Number(flags.max ?? 40);
const optimizeFor = flags.optimize ?? 'cost';

let router = null;
for await (const r of client.routers.list({ limit: 50 })) {
  if (r.slug === SLUG) {
    router = r;
    break;
  }
}
if (!router) {
  router = await client.routers.create({
    slug: SLUG,
    name: 'Trends · vídeo barato',
    description: 'Router criado por runway/scripts/route-video.mjs',
    settings: {
      schemaVersion: 1,
      optimizeFor,
      maxCreditsPerGeneration: { video: maxVideo },
      fallback: { onCapacity: true },
    },
  });
  console.log(`router criado: ${router.slug} (${router.id})`);
} else {
  console.log(`router: ${router.slug} · otimiza por ${router.settings.optimizeFor ?? 'padrão'}`);
}

const input = {
  promptText,
  duration: Number(flags.duration ?? 5),
  aspectRatio: flags.aspect ?? '16:9',
  resolution: flags.resolution ?? '720p',
};
if (flags.seed) input.seed = Number(flags.seed);

const done = await runWithBudget(
  client,
  client.generate.video.create({ configId: router.id, input }),
  budgetFrom(flags),
);
await saveOutputs(done, 'route');
