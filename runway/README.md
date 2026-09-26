# Runway API neste projeto

Scripts em Node para gerar imagens e vídeos com a [Runway API](https://dev.runwayml.com)
a partir do universo da Floresta Isométrica (ou de qualquer prompt). Tudo fica
isolado nesta pasta: o jogo em `../src` continua sem dependências.

Baseado no SDK oficial `@runwayml/sdk` 4.20.1 (set/2026). Quando a versão do SDK
mudar, os modelos e parâmetros válidos estão sempre em
`node_modules/@runwayml/sdk/resources/*.d.ts`, que é a fonte que usamos aqui.

## Setup (2 minutos)

```bash
cd runway
npm install
cp .env.example .env        # cole sua chave: dev.runwayml.com → API Keys
npm run credits             # confere saldo e limites; não gasta nada
```

Requer Node 22.9+ (usa `--env-file-if-exists`, sem dotenv).

## Qual ferramenta Runway usar

| Ferramenta | Quando usar | Como está aqui |
| --- | --- | --- |
| **SDK Node (`@runwayml/sdk`)** | Scripts, backends Node/TS, automação. Tipos cobrem todos os modelos e ratios. | `lib/client.mjs` e todos os scripts |
| SDK Python (`runwayml`) | Pipelines de dados, notebooks. Mesma API, mesmo polling. | não usado |
| REST puro (`https://api.dev.runwayml.com/v1/...`, header `X-Runway-Version: 2024-11-06`) | Outra linguagem, ou n8n/Zapier. | não usado; o SDK já faz retry, timeout e polling |
| **Endpoints por modelo** (`textToImage`, `imageToVideo`, `textToVideo`, `videoToVideo`…) | Você sabe exatamente qual modelo quer e precisa de parâmetros específicos (ProRes, seed, keyframe final). | `scripts/text-to-image.mjs`, `scripts/image-to-video.mjs` |
| **Routers + `generate.*`** | Você quer dizer "o mais barato que atenda 720p/5s" e deixar a Runway escolher, com teto de crédito por geração e fallback se um modelo estiver lotado. | `scripts/route-video.mjs` |
| Recipes (`recipes.productAd`, `multiShotVideo`, `adLocalization`…) | Fluxos prontos de marketing (anúncio de produto, UGC, campanha). | não usado |
| Workflows (`workflows` / `workflowInvocations`) | Encadear várias gerações (imagem → vídeo → upscale → dublagem) num grafo salvo. | não usado; compensa depois de estabilizar o pipeline |
| Áudio (`textToSpeech`, `soundEffect`, `voiceDubbing`, `voiceIsolation`) | Narração, efeitos, dublar vídeo. Modelos ElevenLabs via Runway. | não usado |
| Avatares / Realtime sessions | Apresentador falante, sessões ao vivo. | fora do escopo |

Recomendação para começar: **endpoint por modelo para imagem** (barato, resultado
previsível) e **router para vídeo** (onde o custo varia mais).

## Escolha de modelo por custo-benefício

Custo aparece em **créditos** (1 crédito = US$ 0,01). Todo `create()` devolve
`estimatedCost.credits` antes de gastar; os scripts usam isso como trava
(`--budget`), cancelando a task se a estimativa passar do teto.

Verifique a tabela de preços atual em dev.runwayml.com (a página não foi acessível
desta sessão, então os valores abaixo são orientação relativa, não preço):

### Imagem (texto → imagem)

| Caso | Modelo | Por quê |
| --- | --- | --- |
| Rascunho, variações, testar prompt | `gen4_image_turbo` (exige 1 `--ref`) ou `gemini_2.5_flash` | mais baratos e rápidos; bons para iterar |
| Arte final 1080p com estilo consistente | `gen4_image` (padrão do script) | referências com `tag` para manter personagem/estilo entre imagens |
| Texto legível na imagem, layout de UI | `gpt_image_2` (qualidade `low`/`medium` primeiro) | forte em tipografia; use `quality:'high'` só na versão final |
| 2K/4K direto | `seedream5_pro`, `gemini_image3_pro` | caro; prefira gerar 1K e usar `imageUpscale` |
| Fundo transparente | `gpt_image_2` com `background:'transparent'` | único com essa opção |

Dica de custo: gere 1K com `outputCount` 1, escolha, e só então suba resolução.

### Vídeo (imagem → vídeo / texto → vídeo)

| Caso | Modelo | Por quê |
| --- | --- | --- |
| Animar uma imagem que você já tem, sem áudio | `gen4_turbo` 5 s (padrão) | melhor custo/segundo da família Gen-4; 10 s dobra o custo |
| Teste rápido de movimento | `seedance2_mini` ou `seedance2_fast` | os mais baratos do catálogo; suportam `--audio` |
| Cena final com direção fina, ProRes/HDR | `gen4.5` (2 a 10 s) | mais caro; só depois de validar o movimento no turbo |
| Precisa de áudio sincronizado gerado junto | `veo3.1_fast` (4/6/8 s) | `veo3.1` normal é bem mais caro; use só se o fast não bastar |
| Quadro inicial **e** final definidos | `veo3.1_fast` ou `seedance2` (`position: 'first' | 'last'`) | `gen4_turbo` só aceita quadro inicial |
| Editar um vídeo existente (trocar clima, estilo) | `aleph2` em `videoToVideo` | evita regenerar do zero |
| Não quer pensar em modelo | `npm run route` com `optimizeFor: 'cost'` e `maxCreditsPerGeneration` | a Runway escolhe e respeita o teto |

Regras gerais que economizam mais que a escolha do modelo:
- Duração e resolução dominam o preço. Comece com 5 s / 720p.
- Fixe `--seed` quando estiver ajustando prompt: compara maçã com maçã.
- Baixe as saídas na hora (os scripts já fazem): as URLs expiram.
- `npm run credits` mostra o gasto dos últimos 7 dias por modelo.

## Uso

```bash
# imagem base da ilha, 1080p
npm run image -- "ilha isométrica flat, floresta densa, rio com ponte de tábuas, paleta dessaturada" --budget 10

# animar a imagem gerada por 5 s
npm run video -- ./out/image-xxxxxxxx.png "vento leve nas copas, nuvens passando, câmera parada" --budget 40

# quadro inicial e final, com áudio
npm run video -- ./out/image-xxxxxxxx.png "amanhecer" --model veo3.1_fast --duration 6 --audio --budget 80

# deixar o router escolher o modelo mais barato para 720p/5 s
npm run route -- "raposa atravessa a clareira ao entardecer" --max 40
```

Cada script imprime `task id · estimativa` antes de esperar, e `custo real` ao final.
Saídas vão para `runway/out/` (ignorado pelo git).

## Usando os modelos Claude para este trabalho

Para quem monta prompts e scripts com Claude Code, o custo de tokens também importa:

| Tarefa | Modelo | Motivo |
| --- | --- | --- |
| Gerar/variar dezenas de prompts de imagem, resumir logs de custo | Haiku 4.5 | mais barato; tarefa curta e repetitiva |
| Escrever ou ajustar estes scripts, ler tipos do SDK, depurar 4xx | Sonnet 5 | equilíbrio; entende bem os `.d.ts` |
| Decidir arquitetura (workflows, routers, pipeline com upscale) | Opus 5.5 ou Fable 5.1 | raro e de alto impacto; vale o custo |

Contexto pequeno economiza: aponte o arquivo `.d.ts` do endpoint em vez de colar o
SDK inteiro, e passe só a mensagem de erro, não o log em `RUNWAYML_LOG=debug`.
