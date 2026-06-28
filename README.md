# Gerador Inteligente Lotofácil — v2.3.2

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
