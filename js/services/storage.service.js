const STORAGE_KEY = "gerador-inteligente-lotofacil:v2";

export function buscarHistorico() {
  const dados = localStorage.getItem(STORAGE_KEY);
  return dados ? JSON.parse(dados) : [];
}

export function salvarHistorico(historico) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(historico));
}

export function adicionarJogo(jogo, concurso = "", valorApostado = 0) {
  const historico = buscarHistorico();
  const novoRegistro = {
    id: crypto.randomUUID(),
    data: new Date().toISOString(),
    concurso: concurso || null,
    status: "Não apurado",
    jogo,
    valorApostado: Number(valorApostado) || 0,
    premioRecebido: 0,
    acertos: null,
    resultadoOficial: []
  };

  historico.unshift(novoRegistro);
  salvarHistorico(historico);
  return novoRegistro;
}

export function atualizarUltimoJogo(dadosAtualizados) {
  const historico = buscarHistorico();
  if (!historico.length) return [];

  historico[0] = { ...historico[0], ...dadosAtualizados };
  salvarHistorico(historico);
  return historico;
}

export function limparHistorico() {
  localStorage.removeItem(STORAGE_KEY);
}

const RESULTS_KEY = "gerador-inteligente-lotofacil:resultados-oficiais:v1";

export function buscarResultadosOficiais() {
  const dados = localStorage.getItem(RESULTS_KEY);
  return dados ? JSON.parse(dados) : [];
}

export function salvarResultadoOficial(concurso, numeros) {
  const resultados = buscarResultadosOficiais();
  const concursoNormalizado = concurso ? String(concurso) : `local-${Date.now()}`;
  const existente = resultados.findIndex((item) => String(item.concurso) === concursoNormalizado);
  const registro = {
    concurso: concursoNormalizado,
    numeros: [...numeros].sort((a, b) => a - b),
    dataRegistro: new Date().toISOString()
  };

  if (existente >= 0) resultados[existente] = registro;
  else resultados.unshift(registro);

  resultados.sort((a, b) => {
    const na = Number(a.concurso);
    const nb = Number(b.concurso);
    if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na;
    return new Date(b.dataRegistro) - new Date(a.dataRegistro);
  });

  localStorage.setItem(RESULTS_KEY, JSON.stringify(resultados));
  return resultados;
}
