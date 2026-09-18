# Floresta Isométrica

Um pequeno mundo isométrico em **pixel art 2D**, rodando direto no navegador com
`<canvas>` e JavaScript puro — sem build, sem dependências, e **sem 3D low-poly**:
cada árvore, pedra e animal é um mapa de pixels desenhado por código.

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

- **Terreno procedural** — ruído de valor em oitavas define relevo, umidade e
  linha d'água; a ilha tem praia, mata fechada, clareiras de musgo, afloramentos
  de pedra e uma trilha de terra que a atravessa.
- **Elevação em degraus** — cada tile tem um nível de altura, desenhado com as
  duas faces laterais do losango para dar volume.
- **Cinco espécies** — coelho, raposa, veado, javali e coruja. Cada uma tem
  velocidade, timidez, tamanho de grupo e período de atividade próprios.
- **Comportamento** — os animais perambulam, forrageiam, procuram a margem do
  lago para beber, descansam (com um `z` subindo) e **fogem do cursor**. Os
  noturnos dormem de dia; os diurnos, de noite.
- **Ciclo dia/noite** — o céu e a iluminação da cena mudam ao longo das 24 h.

## Estrutura

```
index.html        marcação e HUD
css/style.css     painéis e tipografia
src/iso.js        projeção isométrica 2:1 e ordenação por profundidade
src/rng.js        PRNG determinístico, ruído de valor e fBm
src/world.js      geração do mapa, trilha e vegetação
src/sprites.js    pixel art procedural (mapas de caracteres -> canvas)
src/animals.js    espécies e máquina de estados de comportamento
src/render.js     desenho dos tiles, sombras, sprites e iluminação
src/main.js       laço principal, câmera, entrada e HUD
```

Nenhum asset externo: rodar offline basta.
