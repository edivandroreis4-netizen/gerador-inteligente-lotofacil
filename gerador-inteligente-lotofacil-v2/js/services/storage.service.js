const STORAGE_KEY = "gerador-inteligente-lotofacil:v2";

export function buscarHistorico() {
  const dados = localStorage.getItem(STORAGE_KEY);
  return dados ? JSON.parse(dados) : [];
}

export function salvarHistorico(historico) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(historico));
}

export function adicionarJogo(jogo) {
  const historico = buscarHistorico();
  const novoRegistro = {
    id: crypto.randomUUID(),
    data: new Date().toISOString(),
    jogo,
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
