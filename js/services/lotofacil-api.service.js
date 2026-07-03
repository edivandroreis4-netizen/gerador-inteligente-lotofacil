const CACHE_KEY = "gerador-inteligente-lotofacil:ultimo-resultado-valido:v2";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CONCURSO_REFERENCIA = 3724;
const DATA_REFERENCIA_UTC = Date.UTC(2026, 6, 2);
const TOLERANCIA_CONCURSOS = 2;

function contarDiasDeSorteioDesdeReferencia() {
  const hoje = new Date();
  const fim = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  if (fim <= DATA_REFERENCIA_UTC) return 0;

  let quantidade = 0;
  for (let dia = DATA_REFERENCIA_UTC + 86400000; dia <= fim; dia += 86400000) {
    if (new Date(dia).getUTCDay() !== 0) quantidade += 1;
  }
  return quantidade;
}

function concursoMinimoEsperado() {
  return CONCURSO_REFERENCIA + contarDiasDeSorteioDesdeReferencia() - TOLERANCIA_CONCURSOS;
}

function cacheValido(cache, concurso = "") {
  if (!cache?.resultado?.dezenas || cache.resultado.dezenas.length !== 15) return false;
  if (!cache?.salvoEm) return false;
  if (Date.now() - new Date(cache.salvoEm).getTime() > CACHE_TTL_MS) return false;
  if (concurso && String(cache.resultado.concurso) !== String(concurso)) return false;
  if (!concurso && Number(cache.resultado.concurso) < concursoMinimoEsperado()) return false;
  return true;
}

function lerCacheLocal(concurso = "") {
  try {
    const texto = localStorage.getItem(CACHE_KEY);
    if (!texto) return null;

    const cache = JSON.parse(texto);
    if (!cacheValido(cache, concurso)) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return {
      ...cache.resultado,
      status: "cache",
      origemCache: true,
      cacheSalvoEm: cache.salvoEm,
      mensagem: "Exibindo o último resultado válido salvo neste dispositivo."
    };
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function salvarCacheLocal(resultado) {
  if (!resultado?.dezenas || resultado.dezenas.length !== 15) return;
  if (Number(resultado.concurso) < concursoMinimoEsperado()) return;

  try {
    const existente = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (existente?.resultado?.concurso > resultado.concurso) return;

    localStorage.setItem(CACHE_KEY, JSON.stringify({
      resultado,
      salvoEm: new Date().toISOString()
    }));
  } catch {
    // O cache não deve interromper o aplicativo.
  }
}

export async function buscarResultadoLotofacil(concurso = "") {
  const parametro = concurso ? `?concurso=${encodeURIComponent(concurso)}` : "";
  let resposta;

  try {
    resposta = await fetch(`/api/lotofacil${parametro}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
  } catch {
    const cache = lerCacheLocal(concurso);
    if (cache) return cache;
    throw new Error("Não foi possível acessar o servidor. A conferência manual continua disponível.");
  }

  const tipoConteudo = resposta.headers.get("content-type") || "";
  if (!tipoConteudo.includes("application/json")) {
    const cache = lerCacheLocal(concurso);
    if (cache) return cache;
    throw new Error("A API não retornou JSON válido. A conferência manual continua disponível.");
  }

  let dados;
  try {
    dados = await resposta.json();
  } catch {
    const cache = lerCacheLocal(concurso);
    if (cache) return cache;
    throw new Error("Não foi possível interpretar a resposta da API.");
  }

  if (dados?.status === "futuro" || dados?.tipo === "proximo_concurso") return dados;

  if (dados?.status === "desatualizado") {
    // Remove também o cache antigo da versão anterior para impedir que o concurso 3246 reapareça.
    localStorage.removeItem("gerador-inteligente-lotofacil:ultimo-resultado-valido:v1");
    localStorage.removeItem(CACHE_KEY);
    const encontrado = dados?.maiorConcursoEncontrado ? ` Último encontrado: ${dados.maiorConcursoEncontrado}.` : "";
    throw new Error(`${dados.erro || "Fontes desatualizadas."}${encontrado} Nenhum resultado antigo será usado.`);
  }

  if (dados?.status === "indisponivel") {
    const cache = lerCacheLocal(concurso);
    if (cache) return cache;

    const erro = new Error(
      [dados?.erro, dados?.mensagem].filter(Boolean).join(" ") ||
      "A consulta automática está indisponível."
    );
    erro.tipo = dados?.tipo || "fonte_indisponivel";
    erro.dados = dados;
    throw erro;
  }

  if (!resposta.ok || dados?.status === "erro") {
    const mensagem = [dados?.erro, dados?.mensagem].filter(Boolean).join(" ");
    const erro = new Error(mensagem || "Não foi possível buscar o resultado.");
    erro.tipo = dados?.tipo || "erro_api";
    erro.dados = dados;
    throw erro;
  }

  if (!Array.isArray(dados?.dezenas) || dados.dezenas.length !== 15) {
    const cache = lerCacheLocal(concurso);
    if (cache) return cache;
    throw new Error("O resultado recebido não contém 15 dezenas válidas.");
  }

  if (!concurso && Number(dados.concurso) < concursoMinimoEsperado()) {
    localStorage.removeItem(CACHE_KEY);
    throw new Error(`Resultado automático desatualizado: concurso ${dados.concurso}. Use a conferência manual.`);
  }

  salvarCacheLocal(dados);
  return dados;
}
