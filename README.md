# Gerador Inteligente Lotofácil — v2.3.3

Aplicação web PWA desenvolvida com HTML, CSS e JavaScript modular para gerar e personalizar jogos, conferir resultados, acompanhar números em atraso e controlar gastos e prêmios.

## Principais melhorias desta versão

- Dashboard profissional com menu lateral no desktop.
- Card roxo com abas **Último resultado** e **Próximo concurso**.
- Dados reais nos cards de resumo, sem contadores fictícios.
- Seleção visual das 15 dezenas no gerador e no conferidor.
- Busca oficial com tratamento de falhas e fontes alternativas.
- Aviso destacado quando os atrasos usam base demonstrativa.
- Controle financeiro persistente em `localStorage`.
- Gráfico responsivo de gastos x prêmios.
- Histórico adaptado para celular.
- Botão de instalação exibido somente quando o PWA pode ser instalado.

## Teste da API oficial

A rota `/api/lotofacil` é uma função serverless da Vercel. Pelo Live Server, a busca oficial não funciona porque não existe um servidor para executar a pasta `api`. Para testar a integração, publique na Vercel ou use `vercel dev`.

## Tecnologias

- HTML5
- CSS3
- JavaScript ES6 Modules
- Chart.js
- SweetAlert2
- LocalStorage
- PWA / Service Worker
- Vercel Functions

## Observação

O sistema não prevê resultados nem aumenta a probabilidade de premiação. As análises são históricas e organizacionais.

**Desenvolvido por Edivandro Lima**


## Ajustes mobile incluídos

- gráfico financeiro com altura reduzida em telas pequenas;
- resumo financeiro organizado em duas colunas;
- histórico exibido como cartões individuais;
- espaçamentos mais compactos;
- menu lateral com botão “Menu/Fechar”, botão interno de fechamento, fundo de bloqueio e suporte à tecla Escape.


## Ajustes finais de responsividade

- Cabeçalho mobile reorganizado em duas linhas.
- Botão de busca oficial em largura total no celular.
- Concurso em destaque nos cards do histórico.
- Data e quantidade de acertos com hierarquia visual melhor.


## Ajuste de concurso futuro

- concursos ainda não apurados abrem automaticamente a aba **Próximo concurso**;
- o app diferencia concurso futuro de falha real da API;
- pesquisas sem número continuam carregando o último concurso apurado.

## Ajuste da integração oficial

A função `api/lotofacil.js` agora consulta primeiro o último concurso apurado e padroniza três estados: `apurado`, `futuro` e `indisponivel`. Dessa forma, um concurso ainda não sorteado abre a aba **Próximo concurso**, enquanto uma falha real da fonte exibe a alternativa de conferência manual.


## Atualização 2.3.3
- Botão Editar jogo em cada registro salvo.
- Edição das dezenas, número do concurso e valor da aposta.
- A conferência anterior é reiniciada quando as dezenas são alteradas, evitando dados inconsistentes.
- Botão Cancelar edição.
- No celular, a busca duplicada do cabeçalho foi ocultada; permanece a busca dentro do conferidor.


## Integração resiliente de resultados — v2.3.3

- removidos `servicebus2` e `servicebus3` como fontes principais;
- fonte principal alternativa: API pública `api.guidi.dev.br`;
- contingência por base JSON pública hospedada no GitHub;
- cache em memória na função serverless e cache persistente no navegador;
- respostas da API sempre padronizadas em JSON;
- conferência manual preservada quando todas as fontes estão indisponíveis;
- URLs construídas com a API WHATWG `new URL()`, sem uso de `url.parse()` no código do projeto.

> Observação: as fontes alternativas são serviços de terceiros e podem ficar indisponíveis ou apresentar atraso. O aplicativo informa a origem dos dados e mantém o modo manual como contingência.
