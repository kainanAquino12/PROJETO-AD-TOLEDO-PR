# Relatório de imagens — EDR Toledo

Origem: `public/uploads/`. Estas versões estão prontas para substituição direta (mesmo nome, mesmas dimensões em pixels, mesmo formato).
Nada em `public/uploads/` foi alterado.

## Fotos dos encontros (JPEG, 8 arquivos únicos)
Diagnóstico: efeito de bloco JPEG moderado (índice 1,25–1,60; o ideal é ≤ 1,1), ruído de croma, brilho entre 118 e 143 e dominante de cor variando de foto para foto (as 3 mais frias/escuras: 67413, 829006 e 811676).
Ação: denoise leve (NLM h=2) para tirar blocos e ruído de croma; balanço de cor puxado ao padrão do álbum (máx. 4% por canal); gama suave rumo ao brilho mediano do álbum (131; limite 0,9–1,1); unsharp mask raio 0,8 / 28% / limiar 4 (sem halo); JPEG q90 progressivo 4:2:0.
Resultado: bloco 1,25–1,60 → 1,21–1,38; nitidez (variância do Laplaciano) +10% a +35%; brilho do álbum entre 125 e 138 (antes 118–143); mesmas dimensões (1600×1200/1204).
Peso: +35% a +45% por arquivo (ex.: 195 → 268 KB).

Fotos duplicadas (byte a byte iguais, cadastradas duas vezes): 861978 = 118039, 949710 = 847190, 500600 = 67413. Foi gerada uma versão de cada par (use o primeiro nome do par).

## Logos (PNG)
- Ultragaz e Edilu: canvas de 1536×1024 com ~95% transparente. Recompressão sem perdas (pixels idênticos): 2068 → 1619 KB e 2541 → 1799 KB.
- OesteVans: já otimizada (a recompressão aumentaria o arquivo), mantida como está.
- Magston (JPEG, fundo branco): sem artefatos relevantes, mantida.

## Sem alteração (sem problema encontrado)
Pastor (Palavra Pastoral e Diretoria), foto da Diretoria (Jocimar), recortes PNG com alfa limpo.

## Limites
Não há modelo de super-resolução neste ambiente; nenhuma imagem precisou de upscale (todas têm resolução maior que a exibida).
