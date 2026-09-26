# Floresta Isométrica

Uma ilha isométrica em **ilustração vetorial flat**, rodando direto no navegador
com `<canvas>` e JavaScript puro — sem build, sem dependências e sem nenhum asset
externo. Cada árvore, pedra, ponte e animal é desenhado com paths, numa paleta
dessaturada de verdes, pedra cinza e água clara, com rótulos em pílula escura.

## Rodar

Como o projeto usa módulos ES, abra por um servidor HTTP (não por `file://`):

```bash
python3 -m http.server 8000
# depois: http://localhost:8000
```

## Controles

| Ação | Comando |
| --- | --- |
| Mover a câmera | arrastar com o mouse, ou `WASD` / setas |
| Zoom | roda do mouse, ou `+` / `-` |
| Inspecionar um animal | clicar nele |
| Acelerar o tempo | `T` (1× → 2× → 4× → 8×) |
| Gerar outra floresta | `R` |

## O que tem dentro

- **Contornos curvos** — o terreno não é desenhado losango a losango: o
  contorno de cada região é extraído da grade e arredondado (Chaikin), então a
  costa, o rio, a trilha e as manchas de pedra saem como curvas contínuas, sem
  serrilhado de escadinha.
- **Ilha procedural** — ruído em oitavas recorta uma costa orgânica; lascas de
  terreno soltas são descartadas. Tem praia na beira d'água, mata fechada,
  clareiras de musgo, afloramentos de pedra, um rio com pontes e uma trilha.
- **Elevação em degraus** — cada tile tem um nível de altura; a borda externa da
  ilha vira penhasco cinza e os degraus internos ficam um tom abaixo do próprio
  terreno, sem virar costura visual.
- **Marcos** — placa de trilha, acampamento com fogueira, veleiro no lago,
  pontes de tábuas e nuvens passando ao fundo.
- **Cinco espécies** — coelho, raposa, veado, javali e coruja. Cada uma tem
  velocidade, timidez, tamanho de grupo e período de atividade próprios.
- **Comportamento** — os animais perambulam, forrageiam, procuram a margem do
  lago para beber, descansam (com um `z` subindo) e **fogem do cursor**. Os
  noturnos dormem de dia; os diurnos, de noite.
- **Rótulos** — cada animal carrega uma pílula com o nome, que some quando a
  câmera se afasta.
- **Ciclo dia/noite** — um véu azulado discreto atravessa as 24 h da ilha.

## Estrutura

```
index.html        marcação e HUD
css/style.css     painéis e tipografia
src/theme.js      paleta única do jogo
src/iso.js        projeção isométrica 2:1 e ordenação por profundidade
src/contour.js    contorno das regiões da grade e suavização por Chaikin
src/rng.js        PRNG determinístico, ruído de valor e fBm
src/world.js      geração da ilha, rio, trilha, vegetação e marcos
src/sprites.js    sprites vetoriais pré-renderizados em canvas offscreen
src/animals.js    espécies e máquina de estados de comportamento
src/render.js     silhuetas do terreno, sombras, sprites e rótulos
src/main.js       laço principal, câmera, entrada e HUD
runway/           scripts para gerar imagens e vídeos com a Runway API (veja runway/README.md)
```

Nenhum asset externo: rodar offline basta.
