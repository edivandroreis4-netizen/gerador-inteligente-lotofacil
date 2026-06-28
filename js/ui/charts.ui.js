let chartParesImpares = null;
let chartAcertos = null;
let chartFinanceiro = null;

export function renderizarGraficoParesImpares(dados) {
  const canvas = document.getElementById("chart-pares-impares");
  if (!canvas || !window.Chart) return;

  if (chartParesImpares) chartParesImpares.destroy();

  chartParesImpares = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Pares", "Ímpares"],
      datasets: [{ data: [dados.pares, dados.impares] }]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#f8fafc" } } }
    }
  });
}

export function renderizarGraficoAcertos(faixas) {
  const canvas = document.getElementById("chart-acertos");
  if (!canvas || !window.Chart) return;

  if (chartAcertos) chartAcertos.destroy();

  chartAcertos = new Chart(canvas, {
    type: "bar",
    data: {
      labels: Object.keys(faixas),
      datasets: [{ label: "Quantidade de jogos", data: Object.values(faixas) }]
    },
    options: {
      responsive: true,
      scales: {
        x: { ticks: { color: "#f8fafc" }, grid: { color: "rgba(255,255,255,.08)" } },
        y: { beginAtZero: true, ticks: { color: "#f8fafc", precision: 0 }, grid: { color: "rgba(255,255,255,.08)" } }
      },
      plugins: { legend: { labels: { color: "#f8fafc" } } }
    }
  });
}


export function renderizarGraficoFinanceiro(historico) {
  const canvas = document.getElementById("chart-financeiro");
  if (!canvas || !window.Chart) return;

  if (chartFinanceiro) chartFinanceiro.destroy();

  const registros = [...historico].reverse().slice(-12);
  const labels = registros.map((item, indice) => item.concurso ? `Concurso ${item.concurso}` : `Jogo ${indice + 1}`);
  const gastos = registros.map((item) => Number(item.valorApostado) || 0);
  const premios = registros.map((item) => Number(item.premioRecebido) || 0);

  chartFinanceiro = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Valor apostado", data: gastos },
        { label: "Prêmio recebido", data: premios }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: { ticks: { color: "#f8fafc" }, grid: { color: "rgba(255,255,255,.08)" } },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#f8fafc",
            callback: (valor) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor)
          },
          grid: { color: "rgba(255,255,255,.08)" }
        }
      },
      plugins: {
        legend: { labels: { color: "#f8fafc" } },
        tooltip: {
          callbacks: {
            label: (contexto) => `${contexto.dataset.label}: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(contexto.parsed.y)}`
          }
        }
      }
    }
  });
}
