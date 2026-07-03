const APOSTA_MINIMA = 3.5;
const TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 30 * 60 * 1000;

// Fonte principal documentada pelo projeto guidi/loteria_api.
const GUIDI_BASE_URL = "https://api.guidi.dev.br/loteria/lotofacil";

// Contingência: arquivo JSON público versionado no GitHub.
const GITHUB_DATA_URL = new URL(
  "https://raw.githubusercontent.com/guilhermeasn/loteria.json/master/data/lotofacil.json"
);

// Cache em memória. Em funções serverless ele persiste durante instâncias aquecidas.
const cacheResultados = new Map();
let cacheUltimoResultado = null;

function numeroSeguro(valor, padrao = 0) {
  if (typeof valor === "string") {
    const normalizado = valor
      .replace(/R\$/gi, "")
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");
    const numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : padrao;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : padrao;
}

function normalizarDezenas(valor) {
  if (!Array.isArray(valor)) return [];

  return [...new Set(
    valor
      .map((dezena) => Number(String(dezena).replace(/\D/g, "")))
      .filter((dezena) => Number.isInteger(dezena) && dezena >= 1 && dezena <= 25)
  )].sort((a, b) => a - b);
}

function obterPrimeiroValor(objeto, chaves) {
  for (const chave of chaves) {
    const valor = objeto?.[chave];
    if (valor !== undefined && valor !== null && valor !== "") return valor;
  }
  return null;
}

function normalizarPremiacao(dados) {
  const lista = obterPrimeiroValor(dados, [
    "listaRateioPremio",
    "premiacao",
    "rateio",
    "premios"
  ]);

  if (!Array.isArray(lista)) return [];

  return lista.map((faixa) => ({
    descricao: obterPrimeiroValor(faixa, ["descricaoFaixa", "descricao", "faixa"]),
    ganhadores: numeroSeguro(obterPrimeiroValor(faixa, ["numeroDeGanhadores", "ganhadores", "quantidadeGanhadores"])),
    valor: numeroSeguro(obterPrimeiroValor(faixa, ["valorPremio", "valor", "premio"]))
  }));
}

function normalizarResultadoAlternativo(dados, fonte) {
  const corpo = dados?.resultado ?? dados?.data ?? dados;
  const concurso = numeroSeguro(obterPrimeiroValor(corpo, [
    "numero",
    "concurso",
    "numeroConcurso",
    "numeroDoConcurso"
  ]));

  const dezenas = normalizarDezenas(obterPrimeiroValor(corpo, [
    "listaDezenas",
    "dezenas",
    "numeros",
    "resultado",
    "resultadoOrdenado",
    "listaDezenasOrdemSorteio"
  ]));

  if (!Number.isInteger(concurso) || concurso <= 0 || dezenas.length !== 15) {
    throw new Error("A fonte alternativa não retornou um concurso válido com 15 dezenas.");
  }

  const proximoConcurso = numeroSeguro(obterPrimeiroValor(corpo, [
    "numeroConcursoProximo",
    "numeroProximoConcurso",
    "proximoConcurso"
  ]), concurso + 1);

  return {
    status: "apurado",
    tipo: "resultado_oficial",
    concurso,
    data: obterPrimeiroValor(corpo, ["dataApuracao", "data", "dataSorteio"]),
    dezenas,
    acumulado: Boolean(obterPrimeiroValor(corpo, ["acumulado", "acumulou"])),
    proximoConcurso,
    dataProximoConcurso: obterPrimeiroValor(corpo, ["dataProximoConcurso", "dataProxConcurso"]),
    horarioProximoConcurso: obterPrimeiroValor(corpo, ["horarioProximoConcurso", "horario"]) || "21h",
    estimativaProximoConcurso: numeroSeguro(obterPrimeiroValor(corpo, [
      "valorEstimadoProximoConcurso",
      "estimativaProximoConcurso",
      "acumuladaProxConcurso",
      "premioEstimado"
    ])),
    valorApostaMinima: APOSTA_MINIMA,
    premiacao: normalizarPremiacao(corpo),
    fonte,
    origemCache: false,
    consultadoEm: new Date().toISOString()
  };
}

function criarResultadoGitHub(concurso, dezenas) {
  return {
    status: "apurado",
    tipo: "resultado_oficial",
    concurso,
    data: null,
    dezenas: normalizarDezenas(dezenas),
    acumulado: false,
    proximoConcurso: concurso + 1,
    dataProximoConcurso: null,
    horarioProximoConcurso: "21h",
    estimativaProximoConcurso: 0,
    valorApostaMinima: APOSTA_MINIMA,
    premiacao: [],
    fonte: "Base pública loteria.json (GitHub)",
    origemCache: false,
    dadosParciais: true,
    consultadoEm: new Date().toISOString()
  };
}

function criarRespostaFuturo(ultimoResultado, concursoSolicitado) {
  const solicitado = Number(concursoSolicitado);
  const proximo = Math.max(
    solicitado,
    Number(ultimoResultado.proximoConcurso || ultimoResultado.concurso + 1)
  );

  return {
    status: "futuro",
    tipo: "proximo_concurso",
    concursoSolicitado: solicitado,
    proximoConcurso: proximo,
    dataProximoConcurso: ultimoResultado.dataProximoConcurso,
    horarioProximoConcurso: ultimoResultado.horarioProximoConcurso || "21h",
    estimativaProximoConcurso: ultimoResultado.estimativaProximoConcurso || 0,
    valorApostaMinima: APOSTA_MINIMA,
    ultimoResultado,
    mensagem: `O concurso ${solicitado} ainda não foi apurado.`,
    fonte: ultimoResultado.fonte,
    consultadoEm: new Date().toISOString()
  };
}

async function fetchJson(url) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const resposta = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Gerador-Inteligente-Lotofacil/2.3.3"
      },
      redirect: "follow",
      signal: controlador.signal
    });

    const texto = await resposta.text();
    if (!resposta.ok) {
      throw new Error(`HTTP ${resposta.status}`);
    }

    try {
      return JSON.parse(texto.replace(/^\uFEFF/, ""));
    } catch {
      throw new Error("Resposta não é JSON válido.");
    }
  } finally {
    clearTimeout(temporizador);
  }
}

function urlGuidi(concurso) {
  return new URL(concurso ? `${GUIDI_BASE_URL}/${concurso}` : `${GUIDI_BASE_URL}/ultimo`);
}

async function consultarGuidi(concurso = "") {
  const dados = await fetchJson(urlGuidi(concurso));
  return normalizarResultadoAlternativo(dados, "API pública guidi.dev.br");
}

async function consultarGitHub(concurso = "") {
  const dados = await fetchJson(GITHUB_DATA_URL);
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    throw new Error("Base do GitHub em formato inesperado.");
  }

  const concursos = Object.keys(dados)
    .map(Number)
    .filter((numero) => Number.isInteger(numero) && numero > 0)
    .sort((a, b) => b - a);

  if (!concursos.length) throw new Error("Base do GitHub sem concursos válidos.");

  const numero = concurso ? Number(concurso) : concursos[0];
  const dezenas = dados[String(numero)];
  if (!Array.isArray(dezenas)) throw new Error(`Concurso ${numero} não encontrado na base do GitHub.`);

  const resultado = criarResultadoGitHub(numero, dezenas);
  if (resultado.dezenas.length !== 15) {
    throw new Error("A base do GitHub não retornou 15 dezenas válidas.");
  }
  return resultado;
}

function chaveCache(concurso = "") {
  return concurso ? `concurso:${concurso}` : "ultimo";
}

function salvarCache(resultado, concurso = "") {
  const entrada = { resultado, salvoEm: Date.now() };
  cacheResultados.set(chaveCache(concurso), entrada);
  cacheResultados.set(`concurso:${resultado.concurso}`, entrada);

  if (!cacheUltimoResultado || resultado.concurso >= cacheUltimoResultado.resultado.concurso) {
    cacheUltimoResultado = entrada;
    cacheResultados.set("ultimo", entrada);
  }
}

function lerCache(concurso = "", aceitarExpirado = false) {
  const entrada = cacheResultados.get(chaveCache(concurso));
  if (!entrada) return null;
  if (!aceitarExpirado && Date.now() - entrada.salvoEm > CACHE_TTL_MS) return null;

  return {
    ...entrada.resultado,
    status: "cache",
    origemCache: true,
    cacheSalvoEm: new Date(entrada.salvoEm).toISOString(),
    mensagem: "Exibindo o último resultado válido armazenado em cache."
  };
}

async function consultarFontesAlternativas(concurso = "") {
  const cacheValido = lerCache(concurso);
  if (cacheValido) return cacheValido;

  const falhas = [];
  const fontes = [consultarGuidi, consultarGitHub];

  for (const consultar of fontes) {
    try {
      const resultado = await consultar(concurso);
      salvarCache(resultado, concurso);
      return resultado;
    } catch (erro) {
      falhas.push(`${consultar.name}: ${erro.message}`);
    }
  }

  const cacheExpirado = lerCache(concurso, true) || (!concurso ? lerCache("", true) : null);
  if (cacheExpirado) return cacheExpirado;

  const erro = new Error("As fontes alternativas não responderam corretamente.");
  erro.falhas = falhas;
  throw erro;
}

function enviar(res, codigo, corpo) {
  return res.status(codigo).json(corpo);
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return enviar(res, 405, {
      status: "erro",
      tipo: "metodo_nao_permitido",
      erro: "Método não permitido.",
      manualMode: true
    });
  }

  const valor = Array.isArray(req.query?.concurso)
    ? req.query.concurso[0]
    : req.query?.concurso;
  const texto = valor ? String(valor).replace(/\D/g, "") : "";
  const concursoSolicitado = texto ? Number(texto) : null;

  if (texto && (!Number.isInteger(concursoSolicitado) || concursoSolicitado <= 0)) {
    return enviar(res, 400, {
      status: "erro",
      tipo: "concurso_invalido",
      erro: "Informe um número de concurso válido.",
      manualMode: true
    });
  }

  try {
    const ultimoResultado = await consultarFontesAlternativas();

    if (!concursoSolicitado || concursoSolicitado === ultimoResultado.concurso) {
      return enviar(res, 200, ultimoResultado);
    }

    if (concursoSolicitado > ultimoResultado.concurso) {
      return enviar(res, 200, criarRespostaFuturo(ultimoResultado, concursoSolicitado));
    }

    try {
      const historico = await consultarFontesAlternativas(String(concursoSolicitado));
      return enviar(res, 200, historico);
    } catch {
      return enviar(res, 404, {
        status: "erro",
        tipo: "concurso_nao_encontrado",
        concursoSolicitado,
        ultimoConcursoApurado: ultimoResultado.concurso,
        erro: `O concurso ${concursoSolicitado} não foi encontrado.`,
        manualMode: true
      });
    }
  } catch (erro) {
    console.error("Falha na integração Lotofácil:", erro.message, erro.falhas || []);

    // Resposta sempre padronizada em JSON. O frontend preserva a conferência manual.
    return enviar(res, 200, {
      status: "indisponivel",
      tipo: "fonte_indisponivel",
      erro: "A consulta automática está temporariamente indisponível.",
      mensagem: "Selecione manualmente as 15 dezenas para continuar.",
      manualMode: true,
      tentarNovamente: true,
      detalhes: process.env.NODE_ENV === "development" ? erro.falhas : undefined,
      consultadoEm: new Date().toISOString()
    });
  }
};
