# Gerador Inteligente Lotofácil — v2.3.3 Revisão 8

Versão com o layout original preservado e a seção **Apostas para CAIXA** simplificada para priorizar a grade visual, a navegação entre apostas e o acompanhamento dos jogos marcados.

## Principais recursos

- Gerador de jogos e avaliação de qualidade dentro do gerador.
- API em camadas para buscar resultados da Lotofácil.
- Cache local do último resultado válido.
- Modo manual quando as fontes automáticas estiverem indisponíveis.
- Conferência de todos os jogos salvos.
- Destaque de aposta premiada e valor por faixa quando fornecido pela API.
- Histórico com filtros, exclusão individual e controle financeiro.
- PWA instalável e responsivo para celular, tablet e desktop.
- Rodapé com **Desenvolvido por Edivandro Lima**.

## Apostas para CAIXA

A seção permite usar os jogos salvos como guia para marcação no ambiente oficial:

- grade visual de 01 a 25;
- dezenas selecionadas em destaque;
- navegação com **Anterior**, **Próximo** e **Próximo pendente**;
- marcar ou desmarcar a aposta como transferida;
- contador de jogos marcados;
- seletor compacto de jogos no celular;
- modo tela cheia;
- botão para abrir o site oficial da CAIXA.

## Alterações da revisão 8

- Removidos **Copiar jogo** e **Copiar todos** da área principal.
- Mantida somente a ação **Copiar números**, dentro do menu recolhível **Mais ações**.
- A grade visual e os controles de navegação passaram a ter prioridade na interface.
- Mantido o contador no formato **3 de 10 jogos marcados**.
- Texto de orientação atualizado para reforçar a marcação visual.
- Cache do Service Worker atualizado para a revisão 8.

## Observação importante

Este aplicativo é independente e não possui vínculo com a CAIXA. Ele não controla nem preenche automaticamente o aplicativo oficial. O usuário deve conferir as dezenas antes de confirmar qualquer aposta. Avaliações estatísticas não garantem premiação.

## Teste local

Use um servidor local:

```bash
python -m http.server 5500
```

Depois acesse `http://localhost:5500`. Não abra diretamente o `index.html`, pois o projeto utiliza módulos JavaScript e Service Worker.

## Publicação

```bash
git add .
git commit -m "Atualiza Projeto Lotofacil v2.3.3 revisao 8"
git push origin main
```

Se o PWA carregar uma versão antiga, limpe os dados do site ou reinstale o aplicativo.
