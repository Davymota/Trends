// Mostra saldo, limites do plano e consumo recente. Não gasta crédito.
//   npm run credits

import { makeClient, fmtCredits } from '../lib/client.mjs';

const client = makeClient();

const org = await client.organization.retrieve();
console.log(`Saldo: ${fmtCredits(org.creditBalance)}`);
console.log(`Teto mensal do plano: ${fmtCredits(org.tier.maxMonthlyCreditSpend)}`);

const rows = Object.entries(org.tier.models)
  .map(([model, lim]) => ({
    modelo: model,
    'simultâneas': lim.maxConcurrentGenerations ?? '∞',
    'por dia': lim.maxDailyGenerations ?? '∞',
    'usadas hoje': org.usage.models[model]?.dailyGenerations ?? 0,
  }))
  .filter((r) => r['usadas hoje'] > 0 || r['simultâneas'] !== '∞');
if (rows.length) console.table(rows);

const startDate = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
const usage = await client.organization.retrieveUsage({ startDate });
const byModel = {};
for (const day of usage.results) {
  for (const u of day.usedCredits) byModel[u.model] = (byModel[u.model] ?? 0) + u.amount;
}
const total = Object.values(byModel).reduce((a, b) => a + b, 0);
console.log(`\nÚltimos 7 dias: ${fmtCredits(total)}`);
for (const [model, amount] of Object.entries(byModel).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${model.padEnd(28)} ${fmtCredits(amount)}`);
}
