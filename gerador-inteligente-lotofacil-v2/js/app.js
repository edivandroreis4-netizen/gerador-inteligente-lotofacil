import { gerarJogo } from "./services/gerador.service.js";
import { conferirAcertos, contarAcertosPorFaixa, contarJogosPremiaveis, contarParesImpares, obterMelhorResultado } from "./services/estatisticas.service.js";
import { adicionarJogo, atualizarUltimoJogo, buscarHistorico, limparHistorico } from "./services/storage.service.js";
import { normalizarNumeros, validarAposta } from "./validators/aposta.validator.js";
import { alertaAcertos, alertaErro, alertaSucesso, confirmarLimpeza } from "./ui/alerts.ui.js";
import { renderizarGraficoAcertos, renderizarGraficoParesImpares } from "./ui/charts.ui.js";

let jogoAtual = [];

const elementos = {
  btnGerar: document.getElementById("btn-gerar"),
  btnSalvar: document.getElementById("btn-salvar"),
  btnLimpar: document.getElementById("btn-limpar"),
  jogoGerado: document.getElementById("jogo-gerado"),
  formConferir: document.getElementById("form-conferir"),
  resultadoOficial: document.getElementById("resultado-oficial"),
  resultadoConferencia: document.getElementById("resultado-conferencia"),
  listaHistorico: document.getElementById("lista-historico"),
  cardTotal: document.getElementById("card-total"),
  cardMelhor: document.getElementById("card-melhor"),
  cardUltimo: document.getElementById("card-ultimo"),
  cardPremiaveis: document.getElementById("card-premiaveis"),
  menuToggle: document.querySelector(".menu-toggle"),
  menu: document.getElementById("menu-principal"),
  btnInstalar: document.getElementById("btn-instalar")
};

let eventoInstalacaoPendente = null;

function criarBolas(numeros) {
  return numeros.map((numero) => `<span class="ball">${String(numero).padStart(2, "0")}</span>`).join("");
}

function renderizarJogo(numeros) {
  elementos.jogoGerado.innerHTML = criarBolas(numeros);
}

function renderizarHistorico() {
  const historico = buscarHistorico();

  if (!historico.length) {
    elementos.listaHistorico.innerHTML = `<p class="empty-state">Nenhum jogo salvo ainda.</p>`;
    return;
  }

  elementos.listaHistorico.innerHTML = historico.map((item) => {
    const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.data));
    const acertos = item.acertos === null ? "Não conferido" : `${item.acertos} acertos`;

    return `
      <article class="history-item">
        <header>
          <span>${data}</span>
          <strong>${acertos}</strong>
        </header>
        <div class="history-balls">${criarBolas(item.jogo)}</div>
      </article>
    `;
  }).join("");
}

function atualizarDashboard() {
  const historico = buscarHistorico();
  const ultimo = historico[0];

  elementos.cardTotal.textContent = historico.length;
  elementos.cardMelhor.textContent = obterMelhorResultado(historico);
  elementos.cardPremiaveis.textContent = contarJogosPremiaveis(historico);
  elementos.cardUltimo.textContent = ultimo ? ultimo.jogo.slice(0, 3).map((n) => String(n).padStart(2, "0")).join("-") + "..." : "--";

  const jogoBase = jogoAtual.length ? jogoAtual : ultimo?.jogo || [];
  renderizarGraficoParesImpares(jogoBase.length ? contarParesImpares(jogoBase) : { pares: 0, impares: 0 });
  renderizarGraficoAcertos(contarAcertosPorFaixa(historico));
}

function iniciarGerador() {
  jogoAtual = gerarJogo();
  renderizarJogo(jogoAtual);
  elementos.btnSalvar.disabled = false;
  atualizarDashboard();
}

function salvarJogoAtual() {
  if (!jogoAtual.length) {
    alertaErro("Nenhum jogo gerado", "Gere um jogo antes de salvar.");
    return;
  }

  adicionarJogo(jogoAtual);
  alertaSucesso("Jogo salvo", "Seu jogo foi salvo no histórico deste navegador.");
  elementos.btnSalvar.disabled = true;
  renderizarHistorico();
  atualizarDashboard();
}

function conferirUltimoJogo(event) {
  event.preventDefault();

  const historico = buscarHistorico();
  const ultimoJogo = historico[0]?.jogo || jogoAtual;

  if (!ultimoJogo.length) {
    alertaErro("Nenhum jogo encontrado", "Gere ou salve um jogo antes de conferir.");
    return;
  }

  const resultado = normalizarNumeros(elementos.resultadoOficial.value);
  const validacao = validarAposta(resultado, 15);

  if (!validacao.valido) {
    alertaErro("Resultado inválido", validacao.mensagem);
    return;
  }

  const conferencia = conferirAcertos(ultimoJogo, resultado);
  atualizarUltimoJogo({
    acertos: conferencia.total,
    resultadoOficial: resultado
  });

  elementos.resultadoConferencia.innerHTML = `
    <h3>${conferencia.total} acertos</h3>
    <p><strong>Números acertados:</strong></p>
    <div class="history-balls">${criarBolas(conferencia.acertados)}</div>
    <p><strong>Números que faltaram no seu jogo:</strong></p>
    <div class="history-balls">${criarBolas(conferencia.errados)}</div>
  `;

  alertaAcertos(conferencia.total);
  renderizarHistorico();
  atualizarDashboard();
}

async function apagarHistorico() {
  const confirmado = await confirmarLimpeza();
  if (!confirmado) return;

  limparHistorico();
  elementos.resultadoConferencia.innerHTML = `
    <h3>Resultado da conferência</h3>
    <p>Depois de gerar um jogo, informe o resultado oficial para ver seus acertos.</p>
  `;
  renderizarHistorico();
  atualizarDashboard();
}

function configurarMenuMobile() {
  elementos.menuToggle.addEventListener("click", () => {
    const aberto = elementos.menu.classList.toggle("open");
    elementos.menuToggle.setAttribute("aria-expanded", String(aberto));
  });

  elementos.menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      elementos.menu.classList.remove("open");
      elementos.menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}


function configurarPWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {
        console.warn("Service Worker não registrado.");
      });
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    eventoInstalacaoPendente = event;

    if (elementos.btnInstalar) {
      elementos.btnInstalar.hidden = false;
    }
  });

  elementos.btnInstalar?.addEventListener("click", async () => {
    if (!eventoInstalacaoPendente) return;

    eventoInstalacaoPendente.prompt();
    await eventoInstalacaoPendente.userChoice;
    eventoInstalacaoPendente = null;
    elementos.btnInstalar.hidden = true;
  });
}

function iniciarApp() {
  elementos.btnGerar.addEventListener("click", iniciarGerador);
  elementos.btnSalvar.addEventListener("click", salvarJogoAtual);
  elementos.formConferir.addEventListener("submit", conferirUltimoJogo);
  elementos.btnLimpar.addEventListener("click", apagarHistorico);

  configurarMenuMobile();
  configurarPWA();
  renderizarHistorico();
  atualizarDashboard();
}

document.addEventListener("DOMContentLoaded", iniciarApp);
