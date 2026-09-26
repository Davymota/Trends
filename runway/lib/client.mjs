// Cliente Runway compartilhado + guarda de créditos.
//
// Toda geração na Runway é uma *task* assíncrona: create() enfileira e devolve
// `estimatedCost.credits` na hora; o resultado chega depois via polling. A ideia
// aqui é usar essa estimativa como trava: se passar do orçamento, cancelamos a
// task antes de ela consumir crédito.

import fs from 'node:fs';
import path from 'node:path';
import RunwayML, { TaskFailedError, TaskTimedOutError, toFile } from '@runwayml/sdk';

export const OUT_DIR = new URL('../out/', import.meta.url).pathname;

export function makeClient() {
  if (!process.env.RUNWAYML_API_SECRET) {
    console.error('Falta RUNWAYML_API_SECRET. Copie runway/.env.example para runway/.env e preencha a chave.');
    process.exit(2);
  }
  return new RunwayML();
}

/** Lê `--flag valor` e `--flag` da linha de comando; o resto vira `positional`. */
export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      let value = true;
      if (next !== undefined && !next.startsWith('--')) {
        value = next;
        i++;
      }
      // `--ref a --ref b` vira ['a', 'b']; flags únicas continuam escalares.
      if (key in flags) flags[key] = [].concat(flags[key], value);
      else flags[key] = value;
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

export function budgetFrom(flags) {
  const raw = flags.budget ?? process.env.RUNWAY_DEFAULT_BUDGET ?? '50';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Orçamento inválido: ${raw}`);
  return n;
}

/**
 * Sobe um arquivo local como upload efêmero e devolve a URI aceita pela API.
 * URLs http(s) e data: passam direto.
 */
export async function resolveAsset(client, ref) {
  if (/^(https?:|data:)/.test(ref)) return ref;
  const file = await toFile(fs.createReadStream(ref), path.basename(ref));
  const { uri } = await client.uploads.createEphemeral({ file });
  console.log(`↑ upload efêmero: ${path.basename(ref)}`);
  return uri;
}

/**
 * Executa uma task respeitando o orçamento.
 *
 * @param client   instância RunwayML
 * @param pending  promise devolvida por client.<endpoint>.create(...)
 * @param budget   máximo de créditos aceito para esta geração
 */
export async function runWithBudget(client, pending, budget) {
  const created = await pending;
  const estimate = created.estimatedCost?.credits ?? created.routing?.estimatedCost?.credits;
  const model = created.routing?.model;
  console.log(
    `task ${created.id} · estimativa ${fmtCredits(estimate)}` + (model ? ` · modelo roteado: ${model}` : ''),
  );

  if (estimate !== undefined && estimate > budget) {
    await client.tasks.delete(created.id);
    console.error(`✗ cancelada: estimativa ${fmtCredits(estimate)} > orçamento ${fmtCredits(budget)}.`);
    console.error('  Reduza duração/resolução, troque de modelo ou passe --budget maior.');
    process.exit(3);
  }

  process.stdout.write('… gerando');
  const tick = setInterval(() => process.stdout.write('.'), 5000);
  try {
    const done = await pending.waitForTaskOutput({ timeout: 15 * 60 * 1000 });
    process.stdout.write('\n');
    console.log(`✓ concluída · custo real ${fmtCredits(done.cost?.credits)}`);
    return done;
  } catch (err) {
    process.stdout.write('\n');
    if (err instanceof TaskFailedError) {
      const d = err.taskDetails;
      console.error(`✗ falhou (${d.failureCode ?? 'sem código'}): ${d.failure ?? d.status}`);
      process.exit(4);
    }
    if (err instanceof TaskTimedOutError) {
      console.error(`✗ tempo esgotado; a task ${created.id} pode ainda concluir. Consulte com client.tasks.retrieve.`);
      process.exit(5);
    }
    throw err;
  } finally {
    clearInterval(tick);
  }
}

/** Baixa as saídas da task. As URLs da Runway expiram, então salve logo. */
export async function saveOutputs(done, prefix) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const saved = [];
  for (const [i, url] of done.output.entries()) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download falhou (${res.status}) para ${url}`);
    const ext = extFrom(res.headers.get('content-type'), url);
    const file = path.join(OUT_DIR, `${prefix}-${done.id.slice(0, 8)}${done.output.length > 1 ? `-${i + 1}` : ''}.${ext}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    saved.push(file);
    console.log(`→ ${path.relative(process.cwd(), file)}`);
  }
  return saved;
}

export function fmtCredits(n) {
  if (n === undefined || n === null) return '? créditos';
  return `${n} créditos (~US$ ${(n / 100).toFixed(2)})`;
}

function extFrom(contentType, url) {
  const map = {
    'video/mp4': 'mp4',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
  };
  if (contentType) {
    const key = contentType.split(';')[0].trim();
    if (map[key]) return map[key];
  }
  const m = new URL(url).pathname.match(/\.([a-z0-9]{2,4})$/i);
  return m ? m[1].toLowerCase() : 'bin';
}
