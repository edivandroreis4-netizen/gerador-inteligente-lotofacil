let chartParesImpares = null;
let chartAcertos = null;

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
