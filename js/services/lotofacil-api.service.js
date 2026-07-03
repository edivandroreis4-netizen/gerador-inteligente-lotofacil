const CACHE_KEY = "gerador-inteligente-lotofacil:ultimo-resultado-valido:v1";

function lerCacheLocal(concurso = "") {
  try {
    const texto = localStorage.getItem(CACHE_KEY);
    if (!texto) return null;

    const cache = JSON.parse(texto);
    if (!cache?.resultado?.dezenas || cache.resultado.dezenas.length !== 15) return null;

    if (concurso && String(cache.resultado.concurso) !== String(concurso)) return null;

    return {
      ...cache.resultado,
      status: "cache",
      origemCache: true,
      cacheSalvoEm: cache.salvoEm,
      mensagem: "Exibindo o último resultado válido salvo neste dispositivo."
    };
  } catch {
    return null;
  }
}

function salvarCacheLocal(resultado) {
  if (!resultado?.dezenas || resultado.dezenas.length !== 15) return;

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      resultado,
      salvoEm: new Date().toISOString()
    }));
  } catch {
    // O cache é uma melhoria de resiliência e não deve interromper o aplicativo.
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

  if (dados?.status === "futuro" || dados?.tipo === "proximo_concurso") {
    return dados;
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

  salvarCacheLocal(dados);
  return dados;
}
