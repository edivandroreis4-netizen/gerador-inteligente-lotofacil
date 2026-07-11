import { gerarJogo } from "./services/gerador.service.js";
import {
  avaliarQualidadeJogo,
  conferirAcertos,
  contarAcertosPorFaixa,
  contarJogosPremiaveis,
  contarParesImpares,
  obterMelhorResultado,
  calcularAtrasosNumeros
} from "./services/estatisticas.service.js";
import {
  adicionarJogo,
  buscarHistorico,
  salvarHistorico,
  limparHistorico,
  removerJogo,
  buscarResultadosOficiais,
  salvarResultadoOficial
} from "./services/storage.service.js";
import { resultadosExemplo } from "./data/resultados.js";
import { buscarResultadoLotofacil } from "./services/lotofacil-api.service.js";
import { validarAposta } from "./validators/aposta.validator.js";
import { alertaAcertos, alertaErro, alertaSucesso, confirmarLimpeza, confirmarExclusaoJogo } from "./ui/alerts.ui.js";
import { renderizarGraficoAcertos, renderizarGraficoParesImpares, renderizarGraficoFinanceiro } from "./ui/charts.ui.js";

let jogoAtual = [];
let resultadoSelecionado = [];
let eventoInstalacaoPendente = null;
let ultimoResultadoCarregado = null;
let filtroHistorico = "todos";
let indiceApostaCaixa = 0;

const $ = (id) => document.getElementById(id);
const elementos = {
  btnGerar: $("btn-gerar"), btnSalvar: $("btn-salvar"), btnLimpar: $("btn-limpar"),
  btnBuscarOficial: $("btn-buscar-oficial"), btnBuscarTopo: $("btn-buscar-topo"), btnAtualizarConcurso: $("btn-atualizar-concurso"),
  statusResultadoOficial: $("status-resultado-oficial"), jogoGerado: $("jogo-gerado"), seletorNumeros: $("seletor-numeros"),
  seletorResultado: $("seletor-resultado"), contadorSelecionados: $("contador-selecionados"), contadorResultado: $("contador-resultado"),
  ajudaEditor: $("ajuda-editor"), numeroConcurso: $("numero-concurso"), valorAposta: $("valor-aposta"), premioRecebido: $("premio-recebido"),
  qualidadeJogo: $("qualidade-jogo"), formConferir: $("form-conferir"), resultadoOficial: $("resultado-oficial"),
  resultadoConferencia: $("resultado-conferencia"), listaHistorico: $("lista-historico"),
  cardTotal: $("card-total"), cardConferidos: $("card-conferidos"), cardMelhor: $("card-melhor"), cardPremiaveis: $("card-premiaveis"),
  cardTotalGasto: $("card-total-gasto"), cardTotalRecebido: $("card-total-recebido"), cardSaldo: $("card-saldo"), cardSaldoContainer: $("card-saldo-container"), cardRetorno: $("card-retorno"),
  statJogos: $("stat-jogos"), statAnalises: $("stat-analises"), financeInvestido: $("finance-investido"), financeRecebido: $("finance-recebido"), financeSaldo: $("finance-saldo"),
  menuToggle: document.querySelector(".menu-toggle"), menuToggleIcon: document.querySelector(".menu-toggle-icon"), menuToggleLabel: document.querySelector(".menu-toggle-label"), menu: $("menu-principal"), menuBackdrop: $("menu-backdrop"), btnFecharMenu: $("btn-fechar-menu"), btnInstalar: $("btn-instalar"), appInstalado: $("app-instalado"),
  atrasadosDestaque: $("atrasados-destaque"), rankingAtrasos: $("ranking-atrasos"), fonteAtrasos: $("fonte-atrasos"), avisoBaseDemo: $("aviso-base-demo"),
  topConcurso: $("top-concurso"), topData: $("top-data"), ultimoConcursoNumero: $("ultimo-concurso-numero"), ultimoConcursoData: $("ultimo-concurso-data"),
  ultimoResultadoBolas: $("ultimo-resultado-bolas"), ultimoConcursoStatus: $("ultimo-concurso-status"), proximoConcursoNumero: $("proximo-concurso-numero"),
  premioEstimado: $("premio-estimado"), proximoConcursoData: $("proximo-concurso-data"), btnLimparResultado: $("btn-limpar-resultado"),
  apostasCaixa: $("apostas-caixa"), caixaEmpty: $("caixa-empty"), caixaWorkspace: $("caixa-workspace"), caixaStatusSummary: $("caixa-status-summary"),
  caixaListaJogos: $("caixa-lista-jogos"), caixaSeletorJogo: $("caixa-seletor-jogo"), caixaJogoTitulo: $("caixa-jogo-titulo"), caixaJogoQualidade: $("caixa-jogo-qualidade"),
  caixaNumerosTexto: $("caixa-numeros-texto"), caixaGrade: $("caixa-grade"), btnCaixaAnterior: $("btn-caixa-anterior"), btnCaixaProximo: $("btn-caixa-proximo"),
  btnCaixaCopiarNumeros: $("btn-caixa-copiar-numeros"), caixaMaisAcoes: $("caixa-mais-acoes"), btnCaixaProximoPendente: $("btn-caixa-proximo-pendente"), btnCaixaMarcar: $("btn-caixa-marcar"), btnCaixaTelaCheia: $("btn-caixa-tela-cheia")
};

function converterMoedaParaNumero(valor) {
  const texto = String(valor ?? "").trim().replace(/\s/g, "");
  if (!texto) return 0;
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  const numero = Number(normalizado.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numero) && numero >= 0 ? numero : NaN;
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor) || 0);
}

function formatarData(valor) {
  if (!valor) return "Data não informada";
  const partes = String(valor).split("/");
  if (partes.length === 3) return valor;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? String(valor) : new Intl.DateTimeFormat("pt-BR").format(data);
}


function ehFaixaPremiada(acertos) {
  return Number(acertos) >= 11;
}

function extrairAcertosFaixa(faixa) {
  const direto = Number(faixa?.acertos ?? faixa?.quantidadeAcertos ?? faixa?.faixa);
  if (Number.isInteger(direto) && direto >= 11 && direto <= 15) return direto;

  const descricao = String(faixa?.descricao ?? faixa?.descricaoFaixa ?? "");
  const encontrado = descricao.match(/(11|12|13|14|15)/);
  return encontrado ? Number(encontrado[1]) : null;
}

function obterPremioOficialPorAcertos(acertos) {
  if (!ehFaixaPremiada(acertos)) return 0;

  const premiacao = Array.isArray(ultimoResultadoCarregado?.premiacao)
    ? ultimoResultadoCarregado.premiacao
    : [];
  const faixa = premiacao.find((item) => extrairAcertosFaixa(item) === Number(acertos));

  return Number(faixa?.valor ?? faixa?.valorPremio ?? faixa?.premio) || 0;
}

function obterTotalPremios(jogos) {
  return jogos.reduce((total, item) => total + (Number(item.premioRecebido) || Number(item.valorPremio) || 0), 0);
}

function calcularResumoFinanceiro(historico) {
  const totalGasto = historico.reduce((total, item) => total + (Number(item.valorApostado) || 0), 0);
  const totalRecebido = historico.reduce((total, item) => total + (Number(item.premioRecebido) || Number(item.valorPremio) || 0), 0);
  const saldo = totalRecebido - totalGasto;
  const retorno = totalGasto > 0 ? (totalRecebido / totalGasto) * 100 : 0;
  return { totalGasto, totalRecebido, saldo, retorno };
}

function criarBolas(numeros) {
  if (!numeros?.length) return "";
  return numeros.map((numero) => `<span class="ball">${String(numero).padStart(2, "0")}</span>`).join("");
}

function formatarNumerosCaixa(numeros = []) {
  return [...numeros].sort((a, b) => a - b).map((numero) => String(numero).padStart(2, "0")).join(" ");
}

function obterJogosParaCaixa() {
  return buscarHistorico()
    .filter((item) => Array.isArray(item.jogo) && item.jogo.length === 15)
    .slice()
    .reverse();
}

function criarGradeCaixa(numeros = []) {
  return Array.from({ length: 25 }, (_, indice) => {
    const numero = indice + 1;
    const selecionado = numeros.includes(numero);
    return `<span class="caixa-grid-number${selecionado ? " selected" : ""}" aria-label="Número ${String(numero).padStart(2, "0")}${selecionado ? " selecionado" : ""}">${String(numero).padStart(2, "0")}</span>`;
  }).join("");
}

function obterJogoCaixaAtual() {
  const jogos = obterJogosParaCaixa();
  if (!jogos.length) return { jogos, jogo: null, indice: 0 };
  if (indiceApostaCaixa < 0) indiceApostaCaixa = 0;
  if (indiceApostaCaixa >= jogos.length) indiceApostaCaixa = jogos.length - 1;
  return { jogos, jogo: jogos[indiceApostaCaixa], indice: indiceApostaCaixa };
}

function renderizarApostasCaixa() {
  const { jogos, jogo, indice } = obterJogoCaixaAtual();
  const totalMarcados = jogos.filter((item) => item.marcadoCaixa === true).length;

  elementos.caixaStatusSummary.textContent = `${totalMarcados} de ${jogos.length} jogos marcados`;

  if (!jogos.length || !jogo) {
    elementos.caixaEmpty.hidden = false;
    elementos.caixaWorkspace.hidden = true;
    elementos.caixaListaJogos.innerHTML = "";
    elementos.caixaSeletorJogo.innerHTML = '<option value="">Nenhum jogo salvo</option>';
    elementos.caixaSeletorJogo.disabled = true;
    elementos.caixaGrade.innerHTML = "";
    elementos.caixaNumerosTexto.textContent = "--";
    return;
  }

  elementos.caixaEmpty.hidden = true;
  elementos.caixaWorkspace.hidden = false;

  elementos.caixaListaJogos.innerHTML = jogos.map((item, posicao) => {
    const qualidade = item.qualidade || avaliarQualidadeJogo(item.jogo || []);
    const ativo = posicao === indice;
    const marcado = item.marcadoCaixa === true;

    return `<button class="caixa-game-button${ativo ? " active" : ""}${marcado ? " done" : ""}" type="button" data-caixa-index="${posicao}" aria-pressed="${ativo}">
      <span class="caixa-game-line"><strong>Jogo ${posicao + 1}</strong><span>${marcado ? "Marcado" : "Pendente"}</span></span>
      <small>Qualidade: ${qualidade.pontos}/100 • ${qualidade.classificacao}</small>
      <span class="caixa-game-numbers">${formatarNumerosCaixa(item.jogo)}</span>
    </button>`;
  }).join("");

  elementos.caixaSeletorJogo.disabled = false;
  elementos.caixaSeletorJogo.innerHTML = jogos.map((item, posicao) => {
    const status = item.marcadoCaixa === true ? "Marcado" : "Pendente";
    return `<option value="${posicao}">Jogo ${posicao + 1} de ${jogos.length} — ${status}</option>`;
  }).join("");
  elementos.caixaSeletorJogo.value = String(indice);

  const qualidadeAtual = jogo.qualidade || avaliarQualidadeJogo(jogo.jogo || []);
  elementos.caixaJogoTitulo.textContent = `Jogo ${indice + 1} de ${jogos.length}`;
  elementos.caixaJogoQualidade.textContent = `Qualidade: ${qualidadeAtual.pontos}/100 • ${qualidadeAtual.classificacao}`;
  elementos.caixaNumerosTexto.textContent = formatarNumerosCaixa(jogo.jogo);
  elementos.caixaGrade.innerHTML = criarGradeCaixa(jogo.jogo);
  elementos.btnCaixaAnterior.disabled = indice === 0;
  elementos.btnCaixaProximo.disabled = indice === jogos.length - 1;
  elementos.btnCaixaProximoPendente.disabled = totalMarcados === jogos.length;
  elementos.btnCaixaMarcar.textContent = jogo.marcadoCaixa === true ? "Desmarcar na CAIXA" : "Marcar como feito na CAIXA";
  elementos.btnCaixaTelaCheia.textContent = elementos.apostasCaixa.classList.contains("caixa-fullscreen") ? "Sair da tela cheia" : "Tela cheia";
}

async function copiarTexto(texto) {
  if (!texto.trim()) return false;

  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch (erro) {
    console.warn("Clipboard API indisponível, usando fallback.", erro);
  }

  const campoTemporario = document.createElement("textarea");
  campoTemporario.value = texto;
  campoTemporario.setAttribute("readonly", "");
  campoTemporario.style.position = "fixed";
  campoTemporario.style.opacity = "0";
  document.body.appendChild(campoTemporario);
  campoTemporario.select();
  const copiado = document.execCommand("copy");
  document.body.removeChild(campoTemporario);
  return copiado;
}

async function copiarNumerosCaixaAtual() {
  const { jogo, indice } = obterJogoCaixaAtual();
  if (!jogo) return alertaErro("Nenhum jogo salvo", "Salve pelo menos um jogo antes de copiar.");

  const texto = formatarNumerosCaixa(jogo.jogo);
  const copiado = await copiarTexto(texto);

  if (elementos.caixaMaisAcoes) {
    elementos.caixaMaisAcoes.open = false;
  }

  if (copiado) {
    alertaSucesso("Números copiados", `As dezenas do jogo ${indice + 1} foram copiadas em formato de texto.`);
  } else {
    alertaErro("Não foi possível copiar", "Copie manualmente os números exibidos acima da grade.");
  }
}

function alternarMarcadoCaixaAtual() {
  const { jogo } = obterJogoCaixaAtual();
  if (!jogo?.id) return;

  const historico = buscarHistorico();
  const atualizado = historico.map((item) => item.id === jogo.id
    ? { ...item, marcadoCaixa: item.marcadoCaixa !== true, marcadoCaixaEm: item.marcadoCaixa === true ? null : new Date().toISOString() }
    : item
  );

  salvarHistorico(atualizado);
  renderizarHistorico();
  atualizarDashboard();
}

function navegarApostaCaixa(direcao) {
  const jogos = obterJogosParaCaixa();
  if (!jogos.length) return;
  indiceApostaCaixa = Math.min(Math.max(indiceApostaCaixa + direcao, 0), jogos.length - 1);
  renderizarApostasCaixa();
}

function irParaProximaApostaPendente() {
  const jogos = obterJogosParaCaixa();
  if (!jogos.length) return alertaErro("Nenhum jogo salvo", "Salve pelo menos um jogo antes de continuar.");

  for (let deslocamento = 1; deslocamento <= jogos.length; deslocamento += 1) {
    const indiceCandidato = (indiceApostaCaixa + deslocamento) % jogos.length;
    if (jogos[indiceCandidato].marcadoCaixa !== true) {
      indiceApostaCaixa = indiceCandidato;
      renderizarApostasCaixa();
      elementos.caixaJogoTitulo.focus?.();
      return;
    }
  }

  alertaSucesso("Todos os jogos estão marcados", "Não há apostas pendentes para transferir à CAIXA.");
}

function alternarTelaCheiaCaixa() {
  const ativo = elementos.apostasCaixa.classList.toggle("caixa-fullscreen");
  document.body.classList.toggle("caixa-fullscreen-open", ativo);
  renderizarApostasCaixa();
}


function obterConcursoDigitado() { return elementos.numeroConcurso.value.trim(); }

function atualizarEstadoEdicao() {
  const total = jogoAtual.length;
  elementos.contadorSelecionados.textContent = `Selecionados: ${total}/15`;
  elementos.btnSalvar.disabled = total !== 15;
  elementos.ajudaEditor.textContent = total === 15 ? "Combinação completa. Toque em um número para trocar." : `Escolha mais ${15 - total} número(s).`;
}

function renderizarSeletor(container, selecionados, classeSelecionado, atributo) {
  container.innerHTML = Array.from({ length: 25 }, (_, i) => i + 1).map((numero) => {
    const ativo = selecionados.includes(numero);
    return `<button class="number-option${ativo ? ` ${classeSelecionado}` : ""}" type="button" ${atributo}="${numero}" aria-pressed="${ativo}">${String(numero).padStart(2, "0")}</button>`;
  }).join("");
}

function renderizarJogo() {
  elementos.jogoGerado.innerHTML = jogoAtual.length ? criarBolas(jogoAtual) : `<span class="empty-state">Gere ou selecione 15 números.</span>`;
  renderizarSeletor(elementos.seletorNumeros, jogoAtual, "selected", "data-number");
  atualizarEstadoEdicao();
}

function renderizarResultadoManual() {
  renderizarSeletor(elementos.seletorResultado, resultadoSelecionado, "result-selected", "data-result-number");
  elementos.contadorResultado.textContent = `${resultadoSelecionado.length}/15`;
  elementos.resultadoOficial.value = resultadoSelecionado.join(" ");
}

function alternarNumero(lista, numero, limite = 15) {
  if (lista.includes(numero)) return lista.filter((item) => item !== numero);
  if (lista.length >= limite) return null;
  return [...lista, numero].sort((a, b) => a - b);
}

function alternarNumeroJogo(numero) {
  const novaLista = alternarNumero(jogoAtual, numero);
  if (!novaLista) return alertaErro("Limite atingido", "Remova um número antes de adicionar outro.");
  jogoAtual = novaLista;
  renderizarJogo();
  renderizarQualidade();
  atualizarDashboard();
}

function alternarNumeroResultado(numero) {
  const novaLista = alternarNumero(resultadoSelecionado, numero);
  if (!novaLista) return alertaErro("Limite atingido", "O resultado deve ter exatamente 15 dezenas.");
  resultadoSelecionado = novaLista;
  renderizarResultadoManual();
}

function renderizarQualidade() {
  if (jogoAtual.length !== 15) {
    elementos.qualidadeJogo.innerHTML = `<span>Qualidade do jogo</span><strong>--/100</strong><p>Complete 15 números para avaliar.</p>`;
    return;
  }
  const qualidade = avaliarQualidadeJogo(jogoAtual);
  elementos.qualidadeJogo.innerHTML = `<span>Qualidade do jogo</span><strong>${qualidade.pontos}/100</strong><p>${qualidade.emoji} ${qualidade.classificacao}</p>`;
}

function obterClasseQualidade(classificacao = "") {
  const texto = String(classificacao).toLowerCase();
  if (texto.includes("excelente")) return "excellent";
  if (texto.includes("boa")) return "good";
  if (texto.includes("baixa")) return "low";
  return "neutral";
}

function filtrarHistorico(historico) {
  const conferido = (item) => Number.isInteger(item.acertos);
  const filtros = {
    todos: () => historico,
    conferidos: () => historico.filter(conferido),
    pendentes: () => historico.filter((item) => !conferido(item)),
    premiaveis: () => historico.filter((item) => (item.acertos || 0) >= 11),
    melhores: () => historico.filter(conferido).sort((a, b) => (b.acertos || 0) - (a.acertos || 0))
  };

  return (filtros[filtroHistorico] || filtros.todos)();
}

function obterRotuloFiltroHistorico() {
  const rotulos = {
    todos: "todos",
    conferidos: "conferidos",
    pendentes: "pendentes",
    premiaveis: "com 11 acertos ou mais",
    melhores: "com melhor desempenho"
  };
  return rotulos[filtroHistorico] || "todos";
}

function renderizarHistorico() {
  const historico = buscarHistorico();
  if (!historico.length) {
    elementos.listaHistorico.innerHTML = `<p class="empty-state">Nenhum jogo salvo ainda.</p>`;
    return;
  }

  const historicoFiltrado = filtrarHistorico(historico);
  if (!historicoFiltrado.length) {
    elementos.listaHistorico.innerHTML = `<p class="empty-state">Nenhum jogo encontrado no filtro ${obterRotuloFiltroHistorico()}.</p>`;
    return;
  }

  elementos.listaHistorico.innerHTML = historicoFiltrado.map((item) => {
    const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.data));
    const foiConferido = Number.isInteger(item.acertos);
    const premiado = Boolean(item.premiado) || ehFaixaPremiada(item.acertos);
    const valor = Number(item.valorApostado) || 0;
    const premio = Number(item.premioRecebido) || Number(item.valorPremio) || 0;
    const saldo = premio - valor;
    const qualidade = item.qualidade || avaliarQualidadeJogo(item.jogo || []);
    const classeQualidade = obterClasseQualidade(qualidade.classificacao);
    const id = item.id || "";
    const status = premiado ? "Aposta premiada" : item.status || (foiConferido ? "Conferido" : "Não apurado");
    const origemPremio = item.origemPremio === "api" ? "valor oficial" : item.origemPremio === "manual" ? "valor informado" : "valor não informado";

    return `<article class="history-item${premiado ? " awarded" : ""}" data-game-id="${id}">
      <header>
        <div class="history-heading">
          <strong class="history-contest">Concurso ${item.concurso || "--"}</strong>
          <span class="history-date">${data}</span>
        </div>
        <strong class="history-hits">${foiConferido ? `${item.acertos} acertos` : "Não conferido"}</strong>
      </header>
      <div class="history-tags">
        <span class="status-badge${status === "Conferido" ? " checked" : ""}${premiado ? " prize" : ""}">${status}</span>
        ${premiado ? `<span class="prize-badge">🏆 ${premio > 0 ? formatarMoeda(premio) : "Prêmio a confirmar"}</span>` : ""}
        <span class="quality-badge ${classeQualidade}">Qualidade: ${qualidade.pontos}/100 • ${qualidade.classificacao}</span>
        ${item.marcadoCaixa ? `<span class="status-badge checked">Marcado na CAIXA</span>` : ""}
      </div>
      <div class="history-balls">${criarBolas(item.jogo)}</div>
      <div class="history-financial"><span>Aposta: <strong>${formatarMoeda(valor)}</strong></span><span>Prêmio: <strong>${formatarMoeda(premio)}</strong></span><span class="${saldo > 0 ? "positive" : saldo < 0 ? "negative" : "neutral"}">Resultado: <strong>${saldo > 0 ? "+" : ""}${formatarMoeda(saldo)}</strong></span></div>
      ${premiado ? `<p class="prize-note">Aposta premiada com ${item.acertos} acertos • ${origemPremio}.</p>` : ""}
      <div class="history-actions">
        <button class="history-delete" type="button" data-delete-game="${id}" aria-label="Excluir jogo do concurso ${item.concurso || "sem concurso"}">Excluir jogo</button>
      </div>
    </article>`;
  }).join("");
}

function renderizarNumerosAtrasados() {
  const resultados = buscarResultadosOficiais();
  const demonstrativa = resultados.length === 0;
  const base = demonstrativa ? resultadosExemplo : resultados;
  const atrasos = calcularAtrasosNumeros(base);
  elementos.fonteAtrasos.textContent = demonstrativa ? "Base demonstrativa" : `${resultados.length} resultado(s) oficial(is)`;
  elementos.avisoBaseDemo.hidden = !demonstrativa;
  elementos.atrasadosDestaque.innerHTML = atrasos.slice(0, 5).map(({ numero, atraso }) => `<div class="delayed-item"><span class="number">${String(numero).padStart(2, "0")}</span><strong>${atraso} concurso${atraso === 1 ? "" : "s"}</strong><span>sem aparecer</span></div>`).join("");
  elementos.rankingAtrasos.innerHTML = atrasos.map(({ numero, atraso }) => `<div class="delay-row"><strong>${String(numero).padStart(2, "0")}</strong><span>${atraso === 0 ? "último" : `${atraso} atrás`}</span></div>`).join("");
}

function atualizarCardConcurso(resultado) {
  if (!resultado) return;
  ultimoResultadoCarregado = resultado;
  elementos.topConcurso.textContent = resultado.concurso || "--";
  elementos.topData.textContent = formatarData(resultado.data);
  elementos.ultimoConcursoNumero.textContent = resultado.concurso || "--";
  elementos.ultimoConcursoData.textContent = formatarData(resultado.data);
  elementos.ultimoResultadoBolas.innerHTML = criarBolas(resultado.dezenas);
  elementos.ultimoConcursoStatus.textContent = resultado.origemDados === "cache" ? "Cache local" : "Carregado";
  elementos.proximoConcursoNumero.textContent = resultado.proximoConcurso || "--";
  elementos.premioEstimado.textContent = formatarMoeda(resultado.estimativaProximoConcurso || 0);
  elementos.proximoConcursoData.textContent = resultado.dataProximoConcurso ? `${formatarData(resultado.dataProximoConcurso)}${resultado.horarioProximoConcurso ? ` às ${resultado.horarioProximoConcurso}` : ""}` : "Consulte novamente perto do sorteio";
}

function atualizarDashboard() {
  const historico = buscarHistorico();
  const conferidos = historico.filter((item) => Number.isInteger(item.acertos)).length;
  const percentual = historico.length ? (conferidos / historico.length) * 100 : 0;
  const financeiro = calcularResumoFinanceiro(historico);
  elementos.cardTotal.textContent = historico.length;
  elementos.cardConferidos.textContent = conferidos;
  elementos.cardMelhor.textContent = obterMelhorResultado(historico);
  elementos.cardPremiaveis.textContent = contarJogosPremiaveis(historico);
  elementos.cardTotalGasto.textContent = formatarMoeda(financeiro.totalGasto);
  elementos.cardTotalRecebido.textContent = formatarMoeda(financeiro.totalRecebido);
  elementos.cardSaldo.textContent = `${financeiro.saldo > 0 ? "+" : ""}${formatarMoeda(financeiro.saldo)}`;
  elementos.cardRetorno.textContent = `${financeiro.retorno.toFixed(2).replace(".", ",")}% de retorno`;
  elementos.cardSaldoContainer.classList.toggle("profit", financeiro.saldo > 0);
  elementos.cardSaldoContainer.classList.toggle("loss", financeiro.saldo < 0);
  elementos.statJogos.textContent = `${historico.length} registro${historico.length === 1 ? "" : "s"}`;
  elementos.statAnalises.textContent = `${percentual.toFixed(0)}% do total`;
  elementos.financeInvestido.textContent = formatarMoeda(financeiro.totalGasto);
  elementos.financeRecebido.textContent = formatarMoeda(financeiro.totalRecebido);
  elementos.financeSaldo.textContent = `${financeiro.saldo > 0 ? "+" : ""}${formatarMoeda(financeiro.saldo)}`;
  const jogoBase = jogoAtual.length ? jogoAtual : historico[0]?.jogo || [];
  renderizarGraficoParesImpares(jogoBase.length ? contarParesImpares(jogoBase) : { pares: 0, impares: 0 });
  renderizarGraficoAcertos(contarAcertosPorFaixa(historico));
  renderizarGraficoFinanceiro(historico);
  renderizarNumerosAtrasados();
  renderizarApostasCaixa();
}

function iniciarGerador() {
  jogoAtual = gerarJogo();
  renderizarJogo();
  renderizarQualidade();
  atualizarDashboard();
}

function salvarJogoAtual() {
  if (jogoAtual.length !== 15) return alertaErro("Jogo incompleto", "Selecione exatamente 15 números.");
  const valor = converterMoedaParaNumero(elementos.valorAposta.value);
  if (!Number.isFinite(valor) || valor <= 0) return alertaErro("Valor inválido", "Informe um valor maior que zero.");
  const qualidade = avaliarQualidadeJogo(jogoAtual);
  adicionarJogo(jogoAtual, obterConcursoDigitado(), valor, qualidade);
  alertaSucesso("Jogo salvo", `A combinação foi salva com qualidade ${qualidade.pontos}/100 (${qualidade.classificacao}).`);
  renderizarHistorico();
  atualizarDashboard();
}

function renderizarResumoConferencia(jogosConferidos, premioInformado) {
  const melhorResultado = jogosConferidos.reduce((maior, item) => Math.max(maior, item.acertos || 0), 0);
  const jogosPremiados = jogosConferidos.filter((item) => Boolean(item.premiado) || ehFaixaPremiada(item.acertos));
  const totalPremios = obterTotalPremios(jogosConferidos);
  const linhas = jogosConferidos.slice(0, 10).map((item, indice) => {
    const premiado = Boolean(item.premiado) || ehFaixaPremiada(item.acertos);
    const premio = Number(item.premioRecebido) || Number(item.valorPremio) || 0;
    const origemPremio = item.origemPremio === "api" ? "valor oficial" : item.origemPremio === "manual" ? "valor informado" : "valor não informado";

    return `
      <article class="conference-row${premiado ? " awarded" : ""}">
        <strong>Jogo ${indice + 1}</strong>
        <span>${item.acertos} acertos</span>
        <div class="history-balls">${criarBolas(item.numerosAcertados || [])}</div>
        ${premiado ? `<div class="conference-prize"><strong>🏆 Aposta premiada</strong><span>${premio > 0 ? formatarMoeda(premio) : "Prêmio a confirmar"}</span><small>${origemPremio}</small></div>` : `<small class="conference-no-prize">Não premiada</small>`}
      </article>
    `;
  }).join("");
  const restante = jogosConferidos.length > 10
    ? `<p class="helper">Mais ${jogosConferidos.length - 10} jogo(s) foram conferidos no histórico.</p>`
    : "";

  elementos.resultadoConferencia.innerHTML = `
    <h3>${jogosConferidos.length} jogo(s) conferido(s)</h3>
    <p>Melhor resultado: <strong>${melhorResultado} acertos</strong></p>
    <p>Apostas premiadas: <strong>${jogosPremiados.length}</strong></p>
    <p>Valor em prêmios: <strong>${formatarMoeda(totalPremios)}</strong></p>
    ${premioInformado > 0 && totalPremios === 0 ? `<p class="helper">Prêmio informado manualmente: <strong>${formatarMoeda(premioInformado)}</strong></p>` : ""}
    <div class="conference-list">${linhas}</div>
    ${restante}
  `;

  alertaAcertos(melhorResultado, totalPremios > 0 ? formatarMoeda(totalPremios) : "");
}

function processarConferencia(resultado, concursoInformado = "") {
  const historico = buscarHistorico();
  const existeHistorico = historico.length > 0;
  const jogosParaConferir = existeHistorico
    ? historico
    : jogoAtual.length
      ? [{
          id: "jogo-atual",
          data: new Date().toISOString(),
          concurso: concursoInformado || obterConcursoDigitado() || null,
          status: "Conferido",
          jogo: jogoAtual,
          valorApostado: converterMoedaParaNumero(elementos.valorAposta.value),
          premioRecebido: 0,
          valorPremio: 0,
          premiado: false,
          origemPremio: "",
          acertos: null,
          qualidade: avaliarQualidadeJogo(jogoAtual),
          resultadoOficial: []
        }]
      : [];

  if (!jogosParaConferir.length) {
    return alertaErro("Nenhum jogo encontrado", "Gere ou salve pelo menos um jogo antes de conferir.");
  }

  const validacao = validarAposta(resultado, 15);
  if (!validacao.valido) return alertaErro("Resultado inválido", validacao.mensagem);

  const premioInformado = converterMoedaParaNumero(elementos.premioRecebido.value);
  if (!Number.isFinite(premioInformado)) return alertaErro("Prêmio inválido", "Informe 0,00 quando não houver prêmio.");

  const concurso = concursoInformado || obterConcursoDigitado() || ultimoResultadoCarregado?.concurso || jogosParaConferir[0]?.concurso || null;
  let premioManualAplicado = false;

  const jogosConferidos = jogosParaConferir.map((item) => {
    const conferencia = conferirAcertos(item.jogo, resultado);
    const premiado = ehFaixaPremiada(conferencia.total);
    let valorPremio = premiado ? obterPremioOficialPorAcertos(conferencia.total) : 0;
    let origemPremio = valorPremio > 0 ? "api" : "";

    if (premiado && valorPremio <= 0 && premioInformado > 0 && !premioManualAplicado) {
      valorPremio = premioInformado;
      origemPremio = "manual";
      premioManualAplicado = true;
    }

    return {
      ...item,
      concurso: concurso || item.concurso || null,
      acertos: conferencia.total,
      numerosAcertados: conferencia.acertados,
      qualidade: item.qualidade || avaliarQualidadeJogo(item.jogo || []),
      resultadoOficial: resultado,
      premiado,
      valorPremio,
      premioRecebido: valorPremio,
      origemPremio,
      status: premiado ? "Aposta premiada" : "Conferido",
      conferidoEm: new Date().toISOString()
    };
  });

  if (existeHistorico) salvarHistorico(jogosConferidos);
  salvarResultadoOficial(concurso, resultado);
  renderizarResumoConferencia(jogosConferidos, premioInformado);
  renderizarHistorico();
  atualizarDashboard();
}

async function buscarEConferirResultadoOficial() {
  const botoes = [elementos.btnBuscarOficial, elementos.btnBuscarTopo, elementos.btnAtualizarConcurso].filter(Boolean);
  botoes.forEach((botao) => { botao.disabled = true; });
  elementos.statusResultadoOficial.textContent = "Consultando a fonte oficial...";
  try {
    const resultado = await buscarResultadoLotofacil(obterConcursoDigitado());

    if (resultado.tipo === "proximo_concurso") {
      const ultimo = resultado.ultimoResultado;
      if (ultimo?.dezenas?.length === 15) atualizarCardConcurso(ultimo);

      elementos.numeroConcurso.value = resultado.proximoConcurso || resultado.concursoSolicitado || "";
      elementos.proximoConcursoNumero.textContent = resultado.proximoConcurso || resultado.concursoSolicitado || "--";
      elementos.premioEstimado.textContent = formatarMoeda(resultado.estimativaProximoConcurso || 0);
      elementos.proximoConcursoData.textContent = resultado.dataProximoConcurso
        ? `${formatarData(resultado.dataProximoConcurso)}${resultado.horarioProximoConcurso ? ` às ${resultado.horarioProximoConcurso}` : ""}`
        : "Data ainda não divulgada";

      ativarAbaConcurso("proximo");
      elementos.statusResultadoOficial.className = "official-status success";
      elementos.statusResultadoOficial.textContent = `Concurso ${resultado.proximoConcurso || resultado.concursoSolicitado} ainda não apurado. Exibindo os dados do próximo sorteio.`;
      alertaSucesso(
        "Concurso ainda não apurado",
        `O concurso ${resultado.proximoConcurso || resultado.concursoSolicitado} é futuro. A aba Próximo concurso foi aberta automaticamente.`
      );
      return;
    }

    elementos.numeroConcurso.value = resultado.concurso;
    resultadoSelecionado = [...resultado.dezenas];
    renderizarResultadoManual();
    salvarResultadoOficial(resultado.concurso, resultado.dezenas);
    atualizarCardConcurso(resultado);
    ativarAbaConcurso("ultimo");
    elementos.statusResultadoOficial.className = "official-status success";
    elementos.statusResultadoOficial.textContent = resultado.origemDados === "cache"
      ? `Concurso ${resultado.concurso} carregado pelo cache local.`
      : `Concurso ${resultado.concurso} carregado com sucesso.`;
    if (buscarHistorico().length || jogoAtual.length) processarConferencia(resultado.dezenas, String(resultado.concurso));
    else alertaSucesso("Resultado oficial carregado", "Agora gere ou salve um jogo para conferir.");
  } catch (erro) {
    elementos.statusResultadoOficial.className = "official-status error";
    elementos.statusResultadoOficial.textContent = erro.message;
    alertaErro("Resultado indisponível", `${erro.message} A seleção manual continua disponível.`);
  } finally {
    botoes.forEach((botao) => { botao.disabled = false; });
  }
}

function ativarAbaConcurso(nomeAba) {
  document.querySelectorAll(".contest-tab").forEach((botao) => {
    const ativo = botao.dataset.tab === nomeAba;
    botao.classList.toggle("active", ativo);
    botao.setAttribute("aria-selected", String(ativo));
  });

  document.querySelectorAll(".contest-panel").forEach((painel) => {
    const ativo = painel.id === `tab-${nomeAba}`;
    painel.hidden = !ativo;
    painel.classList.toggle("active", ativo);
  });
}

function configurarTabsConcurso() {
  document.querySelectorAll(".contest-tab").forEach((botao) => {
    botao.addEventListener("click", () => ativarAbaConcurso(botao.dataset.tab));
  });
}

function configurarMenu() {
  const definirEstadoMenu = (aberto) => {
    elementos.menu.classList.toggle("open", aberto);
    elementos.menuToggle.setAttribute("aria-expanded", String(aberto));
    elementos.menuToggle.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
    elementos.menuToggleIcon.textContent = aberto ? "✕" : "☰";
    elementos.menuToggleLabel.textContent = aberto ? "Fechar" : "Menu";
    elementos.menuBackdrop.hidden = !aberto;
    document.body.classList.toggle("menu-open", aberto);
  };

  elementos.menuToggle.addEventListener("click", () => definirEstadoMenu(!elementos.menu.classList.contains("open")));
  elementos.btnFecharMenu.addEventListener("click", () => definirEstadoMenu(false));
  elementos.menuBackdrop.addEventListener("click", () => definirEstadoMenu(false));
  elementos.menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => definirEstadoMenu(false)));
  window.addEventListener("keydown", (event) => { if (event.key === "Escape") definirEstadoMenu(false); });
  window.addEventListener("resize", () => { if (window.innerWidth > 900) definirEstadoMenu(false); });
}

function configurarNavegacaoAtiva() {
  const links = [...document.querySelectorAll('.sidebar-nav a[href^="#"]')];
  const secoes = links
    .map((link) => ({ link, id: link.getAttribute("href").slice(1), elemento: document.querySelector(link.getAttribute("href")) }))
    .filter((item) => item.elemento);

  let idAtivo = "dashboard";
  let atualizacaoPendente = false;

  const ativarLink = (id) => {
    idAtivo = id;
    secoes.forEach(({ link, id: linkId }) => {
      const ativo = linkId === id;
      link.classList.toggle("active", ativo);
      if (ativo) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  };

  const atualizarPeloScroll = () => {
    atualizacaoPendente = false;
    const alturaTopo = document.querySelector(".topbar")?.offsetHeight || 0;
    const linhaLeitura = window.scrollY + alturaTopo + 36;
    const posicoes = secoes
      .map((item) => ({ ...item, topo: item.elemento.getBoundingClientRect().top + window.scrollY }))
      .sort((a, b) => a.topo - b.topo);
    const alcançadas = posicoes.filter((item) => item.topo <= linhaLeitura);
    if (!alcançadas.length) return ativarLink("dashboard");

    const topoAtual = alcançadas[alcançadas.length - 1].topo;
    const mesmoNivel = alcançadas.filter((item) => Math.abs(item.topo - topoAtual) <= 12);
    const manterAtual = mesmoNivel.find((item) => item.id === idAtivo);
    ativarLink((manterAtual || mesmoNivel[0] || alcançadas[alcançadas.length - 1]).id);
  };

  const solicitarAtualizacao = () => {
    if (atualizacaoPendente) return;
    atualizacaoPendente = true;
    window.requestAnimationFrame(atualizarPeloScroll);
  };

  links.forEach((link) => {
    link.addEventListener("click", () => ativarLink(link.getAttribute("href").slice(1)));
  });

  window.addEventListener("scroll", solicitarAtualizacao, { passive: true });
  window.addEventListener("resize", solicitarAtualizacao);
  window.addEventListener("hashchange", () => {
    const id = window.location.hash.slice(1);
    if (secoes.some((item) => item.id === id)) ativarLink(id);
  });

  const hashInicial = window.location.hash.slice(1);
  ativarLink(secoes.some((item) => item.id === hashInicial) ? hashInicial : "dashboard");
  solicitarAtualizacao();
}

function estaEmModoAplicativo() { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; }
function marcarAppInstalado() { elementos.btnInstalar.hidden = true; elementos.appInstalado.hidden = false; }
function configurarPWA() {
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(console.warn));
  if (estaEmModoAplicativo()) marcarAppInstalado();
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); eventoInstalacaoPendente = event; if (!estaEmModoAplicativo()) elementos.btnInstalar.hidden = false; });
  window.addEventListener("appinstalled", marcarAppInstalado);
  elementos.btnInstalar.addEventListener("click", async () => {
    if (!eventoInstalacaoPendente) return;
    eventoInstalacaoPendente.prompt();
    const escolha = await eventoInstalacaoPendente.userChoice;
    eventoInstalacaoPendente = null;
    if (escolha.outcome === "accepted") marcarAppInstalado();
  });
}

async function apagarHistorico() {
  if (!(await confirmarLimpeza())) return;
  limparHistorico();
  renderizarHistorico();
  atualizarDashboard();
}

async function excluirJogoHistorico(id) {
  if (!id) return;
  if (!(await confirmarExclusaoJogo())) return;
  removerJogo(id);
  renderizarHistorico();
  atualizarDashboard();
  alertaSucesso("Jogo excluído", "O registro foi removido do histórico.");
}

function configurarFiltrosHistorico() {
  document.querySelectorAll("[data-history-filter]").forEach((botao) => {
    botao.addEventListener("click", () => {
      filtroHistorico = botao.dataset.historyFilter || "todos";
      document.querySelectorAll("[data-history-filter]").forEach((item) => {
        const ativo = item === botao;
        item.classList.toggle("active", ativo);
        item.setAttribute("aria-pressed", String(ativo));
      });
      renderizarHistorico();
    });
  });
}



function configurarApostasCaixa() {
  elementos.caixaListaJogos.addEventListener("click", (event) => {
    const botao = event.target.closest("[data-caixa-index]");
    if (!botao) return;
    indiceApostaCaixa = Number(botao.dataset.caixaIndex) || 0;
    renderizarApostasCaixa();
  });

  elementos.caixaSeletorJogo.addEventListener("change", () => {
    indiceApostaCaixa = Number(elementos.caixaSeletorJogo.value) || 0;
    renderizarApostasCaixa();
  });
  elementos.btnCaixaAnterior.addEventListener("click", () => navegarApostaCaixa(-1));
  elementos.btnCaixaProximo.addEventListener("click", () => navegarApostaCaixa(1));
  elementos.btnCaixaCopiarNumeros.addEventListener("click", copiarNumerosCaixaAtual);
  elementos.btnCaixaProximoPendente.addEventListener("click", irParaProximaApostaPendente);
  elementos.btnCaixaMarcar.addEventListener("click", alternarMarcadoCaixaAtual);
  elementos.btnCaixaTelaCheia.addEventListener("click", alternarTelaCheiaCaixa);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elementos.apostasCaixa.classList.contains("caixa-fullscreen")) {
      alternarTelaCheiaCaixa();
    }
  });
}

function iniciarApp() {
  elementos.btnGerar.addEventListener("click", iniciarGerador);
  elementos.btnSalvar.addEventListener("click", salvarJogoAtual);
  elementos.btnLimpar.addEventListener("click", apagarHistorico);
  elementos.formConferir.addEventListener("submit", (event) => { event.preventDefault(); processarConferencia(resultadoSelecionado); });
  [elementos.btnBuscarOficial, elementos.btnBuscarTopo, elementos.btnAtualizarConcurso].forEach((botao) => botao?.addEventListener("click", buscarEConferirResultadoOficial));
  elementos.btnLimparResultado.addEventListener("click", () => { resultadoSelecionado = []; renderizarResultadoManual(); });
  elementos.listaHistorico.addEventListener("click", (event) => { const botao = event.target.closest("[data-delete-game]"); if (botao) excluirJogoHistorico(botao.dataset.deleteGame); });
  elementos.seletorNumeros.addEventListener("click", (event) => { const botao = event.target.closest("[data-number]"); if (botao) alternarNumeroJogo(Number(botao.dataset.number)); });
  elementos.seletorResultado.addEventListener("click", (event) => { const botao = event.target.closest("[data-result-number]"); if (botao) alternarNumeroResultado(Number(botao.dataset.resultNumber)); });
  configurarMenu(); configurarNavegacaoAtiva(); configurarTabsConcurso(); configurarFiltrosHistorico(); configurarApostasCaixa(); configurarPWA();
  renderizarJogo(); renderizarResultadoManual(); renderizarQualidade(); renderizarHistorico(); atualizarDashboard();
}

document.addEventListener("DOMContentLoaded", iniciarApp);
