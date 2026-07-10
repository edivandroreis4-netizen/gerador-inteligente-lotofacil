# Gerador Inteligente Lotofácil — v2.3.3

Aplicação web PWA desenvolvida com HTML, CSS e JavaScript modular para gerar e personalizar jogos, conferir resultados, acompanhar números em atraso e controlar gastos e prêmios.

Esta versão mantém o mesmo layout da base enviada no arquivo RAR e altera somente a lógica necessária para a versão 2.3.3.

## Correções e melhorias da v2.3.3

- Mantido o layout original da versão enviada no RAR.
- Corrigida a conferência: agora o app confere todos os jogos salvos no histórico.
- Corrigido o gráfico de acertos para considerar somente jogos realmente conferidos.
- Mantida a camada de API em `/api/lotofacil.js` para uso na Vercel.
- Mantida a camada client-side em `js/services/lotofacil-api.service.js`.
- Incluído cache local do último resultado oficial válido.
- Se a API falhar, o app tenta recuperar o resultado em cache antes de pedir conferência manual.
- Mantido o modo manual para selecionar as 15 dezenas diretamente na tela.
- Atualizado o cache do Service Worker para a versão 2.3.3.

## Estrutura principal

```txt
api/lotofacil.js                       # Função serverless para consultar a Lotofácil
js/services/lotofacil-api.service.js   # Camada de API no navegador com fallback para cache
js/services/storage.service.js         # Persistência em localStorage
js/services/estatisticas.service.js    # Conferência e estatísticas
js/app.js                              # Orquestração da interface e regras da aplicação
css/style.css                          # Layout original preservado
```

## Como testar localmente

Para testar apenas o layout e o modo manual, pode usar Live Server no VS Code.

Para testar a API serverless localmente, use a Vercel CLI:

```bash
vercel dev
```

A rota esperada é:

```txt
/api/lotofacil
/api/lotofacil?concurso=3722
```

## Observação importante

O sistema não prevê resultados nem aumenta a probabilidade de premiação. As análises são históricas e organizacionais.

**Desenvolvido por Edivandro Lima**


## Correções desta revisão

- Mantido o layout original enviado no RAR.
- API ajustada em camadas: função `/api/lotofacil`, fallback público e cache local.
- A conferência continua analisando todos os jogos salvos.
- Assinatura duplicada removida: agora existe uma assinatura oficial no rodapé principal.
- Rodapé mobile exibe `Desenvolvido por Edivandro Lima` com foto.
- Menu mobile alterado para abrir de cima para baixo.

### Observação sobre a API

No teste local com Live Server, a rota `/api/lotofacil` não roda como função serverless. Por isso esta versão também tenta uma API pública de fallback diretamente pelo navegador. Na Vercel, a função serverless continua funcionando normalmente em `/api/lotofacil`.


## Revisão 2 — ajustes finais

- Removido o bloco de perfil/assinatura do topo.
- Mantida a assinatura oficial apenas no rodapé, com foto.
- Corrigido o contraste dos números exibidos nos jogos conferidos.
- Mantidos API, cache, modo manual e conferência de todos os jogos.


## Revisão 3 — ajuste visual solicitado

- A seção **Qualidade do jogo** foi movida para dentro do painel **Gerador de jogos**.
- O card de qualidade agora aparece logo abaixo das dezenas geradas/selecionadas, facilitando a leitura antes de salvar o jogo.
- O painel separado de qualidade foi removido da área de estatísticas para evitar repetição visual.
- Cache do Service Worker atualizado para revisão 3.


## Revisão 5 — próximas melhorias implementadas

- Histórico ganhou filtros rápidos: todos, conferidos, pendentes, 11+ acertos e melhores resultados.
- Cada jogo salvo agora registra a **qualidade do jogo** no histórico.
- Adicionado botão para excluir um jogo individualmente, sem precisar limpar todo o histórico.
- Filtros e ações foram ajustados para celular, mantendo o layout original.
- Cache do Service Worker atualizado para revisão 4.


## Revisão 5

Ajustes incluídos:

- Identificação automática de jogo premiado a partir de 11 acertos.
- Exibição do selo **Aposta premiada** no resultado da conferência e no histórico.
- Exibição do valor do prêmio quando a API retornar a premiação oficial por faixa.
- Quando a API não informar valores, o app mantém a conferência e mostra o prêmio como pendente/confirmar.
- O campo manual de prêmio continua funcionando como apoio quando o valor oficial não vier da API.
- Cache do Service Worker atualizado para evitar carregar a revisão anterior.
