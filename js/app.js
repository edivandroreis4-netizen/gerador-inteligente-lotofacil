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
  atualizarUltimoJogo,
  buscarHistorico,
  limparHistorico,
  buscarResultadosOficiais,
  salvarResultadoOficial
} from "./services/storage.service.js";
import { resultadosExemplo } from "./data/resultados.js";
import { buscarResultadoLotofacil } from "./services/lotofacil-api.service.js";
import { validarAposta } from "./validators/aposta.validator.js";
import { alertaAcertos, alertaErro, alertaSucesso, confirmarLimpeza } from "./ui/alerts.ui.js";
import { renderizarGraficoAcertos, renderizarGraficoParesImpares, renderizarGraficoFinanceiro } from "./ui/charts.ui.js";

let jogoAtual = [];
let resultadoSelecionado = [];
let eventoInstalacaoPendente = null;
let ultimoResultadoCarregado = null;

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
  premioEstimado: $("premio-estimado"), proximoConcursoData: $("proximo-concurso-data"), btnLimparResultado: $("btn-limpar-resultado")
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

function calcularResumoFinanceiro(historico) {
  const totalGasto = historico.reduce((total, item) => total + (Number(item.valorApostado) || 0), 0);
  const totalRecebido = historico.reduce((total, item) => total + (Number(item.premioRecebido) || 0), 0);
  const saldo = totalRecebido - totalGasto;
  const retorno = totalGasto > 0 ? (totalRecebido / totalGasto) * 100 : 0;
  return { totalGasto, totalRecebido, saldo, retorno };
}

function criarBolas(numeros) {
  if (!numeros?.length) return "";
  return numeros.map((numero) => `<span class="ball">${String(numero).padStart(2, "0")}</span>`).join("");
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

function renderizarHistorico() {
  const historico = buscarHistorico();
  if (!historico.length) {
    elementos.listaHistorico.innerHTML = `<p class="empty-state">Nenhum jogo salvo ainda.</p>`;
    return;
  }
  elementos.listaHistorico.innerHTML = historico.map((item) => {
    const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.data));
    const status = item.status || (item.acertos === null ? "Não apurado" : "Conferido");
    const valor = Number(item.valorApostado) || 0;
    const premio = Number(item.premioRecebido) || 0;
    const saldo = premio - valor;
    return `<article class="history-item">
      <header><div class="history-heading"><strong class="history-contest">Concurso ${item.concurso || "--"}</strong><span class="history-date">${data}</span></div><strong class="history-hits">${item.acertos === null ? "Não conferido" : `${item.acertos} acertos`}</strong></header>
      <span class="status-badge${status === "Conferido" ? " checked" : ""}">${status}</span>
      <div class="history-balls">${criarBolas(item.jogo)}</div>
      <div class="history-financial"><span>Aposta: <strong>${formatarMoeda(valor)}</strong></span><span>Prêmio: <strong>${formatarMoeda(premio)}</strong></span><span class="${saldo > 0 ? "positive" : saldo < 0 ? "negative" : "neutral"}">Resultado: <strong>${saldo > 0 ? "+" : ""}${formatarMoeda(saldo)}</strong></span></div>
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
  elementos.ultimoConcursoStatus.textContent = "Carregado";
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
  adicionarJogo(jogoAtual, obterConcursoDigitado(), valor);
  alertaSucesso("Jogo salvo", "A combinação e os dados financeiros foram salvos neste navegador.");
  renderizarHistorico();
  atualizarDashboard();
}

function processarConferencia(resultado, concursoInformado = "") {
  const historico = buscarHistorico();
  const jogo = historico[0]?.jogo || jogoAtual;
  if (!jogo.length) return alertaErro("Nenhum jogo encontrado", "Gere ou salve um jogo antes de conferir.");
  const validacao = validarAposta(resultado, 15);
  if (!validacao.valido) return alertaErro("Resultado inválido", validacao.mensagem);
  const conferencia = conferirAcertos(jogo, resultado);
  const premio = converterMoedaParaNumero(elementos.premioRecebido.value);
  if (!Number.isFinite(premio)) return alertaErro("Prêmio inválido", "Informe 0,00 quando não houver prêmio.");
  const concurso = concursoInformado || historico[0]?.concurso || obterConcursoDigitado();
  atualizarUltimoJogo({ acertos: conferencia.total, resultadoOficial: resultado, premioRecebido: premio, status: "Conferido", concurso: concurso || null });
  salvarResultadoOficial(concurso, resultado);
  elementos.resultadoConferencia.innerHTML = `<h3>${conferencia.total} acertos</h3><p>Prêmio informado: <strong>${formatarMoeda(premio)}</strong></p><p>Números acertados:</p><div class="history-balls">${criarBolas(conferencia.acertados)}</div>`;
  alertaAcertos(conferencia.total);
  renderizarHistorico();
  atualizarDashboard();
}

async function buscarEConferirResultadoOficial() {
  const botoes = [elementos.btnBuscarOficial, elementos.btnBuscarTopo, elementos.btnAtualizarConcurso].filter(Boolean);
  botoes.forEach((botao) => { botao.disabled = true; });
  elementos.statusResultadoOficial.textContent = "Consultando a fonte oficial...";
  try {
    const resultado = await buscarResultadoLotofacil(obterConcursoDigitado());
    elementos.numeroConcurso.value = resultado.concurso;
    resultadoSelecionado = [...resultado.dezenas];
    renderizarResultadoManual();
    salvarResultadoOficial(resultado.concurso, resultado.dezenas);
    atualizarCardConcurso(resultado);
    elementos.statusResultadoOficial.className = "official-status success";
    elementos.statusResultadoOficial.textContent = `Concurso ${resultado.concurso} carregado com sucesso.`;
    if (buscarHistorico()[0]?.jogo?.length || jogoAtual.length) processarConferencia(resultado.dezenas, String(resultado.concurso));
    else alertaSucesso("Resultado oficial carregado", "Agora gere ou salve um jogo para conferir.");
  } catch (erro) {
    elementos.statusResultadoOficial.className = "official-status error";
    elementos.statusResultadoOficial.textContent = erro.message;
    alertaErro("Resultado indisponível", `${erro.message} A seleção manual continua disponível.`);
  } finally {
    botoes.forEach((botao) => { botao.disabled = false; });
  }
}

function configurarTabsConcurso() {
  document.querySelectorAll(".contest-tab").forEach((botao) => botao.addEventListener("click", () => {
    document.querySelectorAll(".contest-tab").forEach((item) => item.classList.toggle("active", item === botao));
    document.querySelectorAll(".contest-panel").forEach((painel) => {
      const ativo = painel.id === `tab-${botao.dataset.tab}`;
      painel.hidden = !ativo;
      painel.classList.toggle("active", ativo);
    });
  }));
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

function iniciarApp() {
  elementos.btnGerar.addEventListener("click", iniciarGerador);
  elementos.btnSalvar.addEventListener("click", salvarJogoAtual);
  elementos.btnLimpar.addEventListener("click", apagarHistorico);
  elementos.formConferir.addEventListener("submit", (event) => { event.preventDefault(); processarConferencia(resultadoSelecionado); });
  [elementos.btnBuscarOficial, elementos.btnBuscarTopo, elementos.btnAtualizarConcurso].forEach((botao) => botao?.addEventListener("click", buscarEConferirResultadoOficial));
  elementos.btnLimparResultado.addEventListener("click", () => { resultadoSelecionado = []; renderizarResultadoManual(); });
  elementos.seletorNumeros.addEventListener("click", (event) => { const botao = event.target.closest("[data-number]"); if (botao) alternarNumeroJogo(Number(botao.dataset.number)); });
  elementos.seletorResultado.addEventListener("click", (event) => { const botao = event.target.closest("[data-result-number]"); if (botao) alternarNumeroResultado(Number(botao.dataset.resultNumber)); });
  configurarMenu(); configurarTabsConcurso(); configurarPWA();
  renderizarJogo(); renderizarResultadoManual(); renderizarQualidade(); renderizarHistorico(); atualizarDashboard();
}

document.addEventListener("DOMContentLoaded", iniciarApp);
