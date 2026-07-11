const API_CACHE_KEY = "gerador-inteligente-lotofacil:api-cache:v2.3.3";
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const BROWSER_FALLBACK_BASE = "https://loteriascaixa-api.herokuapp.com/api/lotofacil";

function lerCacheApi() {
  try {
    const dados = localStorage.getItem(API_CACHE_KEY);
    return dados ? JSON.parse(dados) : { ultimo: null, concursos: {} };
  } catch {
    return { ultimo: null, concursos: {} };
  }
}

function salvarCacheApi(cache) {
  localStorage.setItem(API_CACHE_KEY, JSON.stringify(cache));
}

function cacheExpirado(registro) {
  if (!registro?.salvoEm) return true;
  return Date.now() - new Date(registro.salvoEm).getTime() > CACHE_MAX_AGE_MS;
}

function normalizarDezenas(valor) {
  if (!Array.isArray(valor)) return [];
  return [...new Set(
    valor
      .map((dezena) => Number(String(dezena).replace(/\D/g, "")))
      .filter((dezena) => Number.isInteger(dezena) && dezena >= 1 && dezena <= 25)
  )].sort((a, b) => a - b);
}

function numeroSeguro(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function extrairAcertosFaixa(faixa) {
  const direto = Number(faixa?.acertos ?? faixa?.quantidadeAcertos ?? faixa?.faixa);
  if (Number.isInteger(direto) && direto >= 11 && direto <= 15) return direto;

  const descricao = String(faixa?.descricaoFaixa ?? faixa?.descricao ?? "");
  const encontrado = descricao.match(/(11|12|13|14|15)/);
  return encontrado ? Number(encontrado[1]) : null;
}

function normalizarPremiacao(dados) {
  const faixas = dados?.listaRateioPremio ?? dados?.premiacoes ?? [];
  if (!Array.isArray(faixas)) return [];

  return faixas.map((faixa) => {
    const acertos = extrairAcertosFaixa(faixa);

    return {
      acertos,
      descricao: faixa?.descricaoFaixa ?? faixa?.descricao ?? (acertos ? `${acertos} acertos` : null),
      ganhadores: numeroSeguro(faixa?.numeroDeGanhadores ?? faixa?.ganhadores ?? faixa?.vencedores),
      valor: numeroSeguro(faixa?.valorPremio ?? faixa?.premio ?? faixa?.valor)
    };
  });
}

function normalizarResultado(dados, origemDados = "api") {
  if (!dados || typeof dados !== "object") {
    throw new Error("A resposta da API veio vazia ou inválida.");
  }

  if (dados.status === "futuro" || dados.tipo === "proximo_concurso") {
    return { ...dados, origemDados };
  }

  const concurso = Number(dados.numero ?? dados.concurso);
  const dezenas = normalizarDezenas(
    dados.listaDezenas ??
    dados.dezenas ??
    dados.dezenasSorteadasOrdemSorteio ??
    dados.listaDezenasOrdemSorteio
  );

  if (!Number.isInteger(concurso) || concurso <= 0 || dezenas.length !== 15) {
    throw new Error("A API respondeu, mas não retornou um concurso válido com 15 dezenas.");
  }

  return {
    status: "apurado",
    tipo: "resultado_oficial",
    concurso,
    data: dados.dataApuracao ?? dados.data ?? null,
    dezenas,
    acumulado: Boolean(dados.acumulado ?? dados.acumulou),
    proximoConcurso: Number(dados.numeroConcursoProximo ?? dados.proximoConcurso ?? concurso + 1),
    dataProximoConcurso: dados.dataProximoConcurso ?? null,
    horarioProximoConcurso: dados.horarioProximoConcurso ?? "21h",
    estimativaProximoConcurso: numeroSeguro(dados.valorEstimadoProximoConcurso ?? dados.valorEstimadoProximoConcursoFinal),
    valorApostaMinima: 3.5,
    premiacao: normalizarPremiacao(dados),
    fonte: dados.fonte ?? "API de resultados da Lotofácil",
    origemDados,
    consultadoEm: new Date().toISOString()
  };
}

function salvarResultadoEmCache(resultado) {
  if (!resultado || resultado.tipo !== "resultado_oficial" || !Array.isArray(resultado.dezenas)) return;

  const cache = lerCacheApi();
  const registro = {
    ...resultado,
    salvoEm: new Date().toISOString(),
    origemDados: "cache"
  };

  cache.ultimo = registro;
  cache.concursos = cache.concursos || {};
  cache.concursos[String(resultado.concurso)] = registro;
  salvarCacheApi(cache);
}

function buscarResultadoEmCache(concurso = "") {
  const cache = lerCacheApi();
  const concursoNormalizado = concurso ? String(concurso).replace(/\D/g, "") : "";
  const registro = concursoNormalizado
    ? cache.concursos?.[concursoNormalizado]
    : cache.ultimo;

  if (!registro || cacheExpirado(registro)) return null;

  return {
    ...registro,
    origemDados: "cache",
    mensagemCache: "Resultado recuperado do cache local porque a API não respondeu."
  };
}

async function lerJsonResposta(resposta, nomeFonte) {
  const tipoConteudo = resposta.headers.get("content-type") || "";
  const texto = await resposta.text();

  if (!resposta.ok) {
    throw new Error(`${nomeFonte} respondeu HTTP ${resposta.status}.`);
  }

  if (!tipoConteudo.includes("application/json") && !texto.trim().startsWith("{")) {
    throw new Error(`${nomeFonte} não retornou JSON válido.`);
  }

  try {
    return JSON.parse(texto.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(`${nomeFonte} retornou JSON inválido.`);
  }
}

function deveConsultarApiLocal() {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  const ambienteLocal = window.location.protocol === "file:" || ["localhost", "127.0.0.1", "::1"].includes(host);
  return !ambienteLocal;
}

async function consultarApiLocal(concurso = "") {
  const parametro = concurso ? `?concurso=${encodeURIComponent(concurso)}` : "";
  const resposta = await fetch(`/api/lotofacil${parametro}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  const dados = await lerJsonResposta(resposta, "API local/Vercel");

  if (dados?.status === "erro" || dados?.status === "indisponivel") {
    const mensagem = [dados?.erro, dados?.mensagem].filter(Boolean).join(" ");
    throw new Error(mensagem || "A API local não conseguiu buscar o resultado.");
  }

  return normalizarResultado(dados, "api");
}

async function consultarApiPublica(concurso = "") {
  const caminho = concurso
    ? `${BROWSER_FALLBACK_BASE}/${encodeURIComponent(concurso)}`
    : `${BROWSER_FALLBACK_BASE}/latest`;

  const resposta = await fetch(caminho, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  const dados = await lerJsonResposta(resposta, "API pública de fallback");
  return normalizarResultado({ ...dados, fonte: "API pública Loterias CAIXA" }, "api-fallback");
}

function erroFinal(falhas) {
  const mensagem = falhas.filter(Boolean).join(" | ");
  return new Error(
    mensagem ||
    "Não foi possível acessar as fontes automáticas. Use o modo manual para informar as 15 dezenas."
  );
}

export async function buscarResultadoLotofacil(concurso = "") {
  const falhas = [];

  const consultas = deveConsultarApiLocal()
    ? [consultarApiLocal, consultarApiPublica]
    : [consultarApiPublica];

  for (const consulta of consultas) {
    try {
      const resultado = await consulta(concurso);
      if (resultado.tipo === "resultado_oficial") salvarResultadoEmCache(resultado);
      return resultado;
    } catch (erro) {
      falhas.push(erro.message);
    }
  }

  const cache = buscarResultadoEmCache(concurso);
  if (cache) return cache;

  throw erroFinal(falhas);
}
