const APOSTA_MINIMA = 3.5;
const TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TOLERANCIA_CONCURSOS = 2;

// Referência conhecida usada apenas para detectar fontes paradas no tempo.
// A estimativa avança automaticamente considerando sorteios de segunda a sábado.
const CONCURSO_REFERENCIA = 3724;
const DATA_REFERENCIA_UTC = Date.UTC(2026, 6, 2); // 02/07/2026

const GUIDI_BASE_URL = "https://api.guidi.dev.br/loteria/lotofacil";
const GITHUB_DATA_URL = new URL(
  "https://raw.githubusercontent.com/guilhermeasn/loteria.json/master/data/lotofacil.json"
);

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
    "premiacoes",
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
    "dezenasOrdemSorteio",
    "listaDezenasOrdemSorteio"
  ]));

  if (!Number.isInteger(concurso) || concurso <= 0 || dezenas.length !== 15) {
    throw new Error("A fonte não retornou um concurso válido com 15 dezenas.");
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
  const resultado = {
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
    fonte: "Base histórica pública loteria.json (GitHub)",
    origemCache: false,
    dadosParciais: true,
    consultadoEm: new Date().toISOString()
  };

  if (resultado.dezenas.length !== 15) {
    throw new Error("A base histórica não retornou 15 dezenas válidas.");
  }

  return resultado;
}

function contarDiasDeSorteioDesdeReferencia() {
  const hoje = new Date();
  const fim = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  if (fim <= DATA_REFERENCIA_UTC) return 0;

  let quantidade = 0;
  for (let dia = DATA_REFERENCIA_UTC + 86400000; dia <= fim; dia += 86400000) {
    const diaSemana = new Date(dia).getUTCDay();
    if (diaSemana !== 0) quantidade += 1; // Lotofácil: segunda a sábado.
  }
  return quantidade;
}

function obterConcursoMinimoEsperado() {
  return CONCURSO_REFERENCIA + contarDiasDeSorteioDesdeReferencia() - TOLERANCIA_CONCURSOS;
}

function validarAtualidade(resultado) {
  const minimo = obterConcursoMinimoEsperado();
  if (Number(resultado?.concurso) < minimo) {
    const erro = new Error(
      `Fonte desatualizada: concurso ${resultado?.concurso || "desconhecido"}; esperado pelo menos ${minimo}.`
    );
    erro.tipo = "fonte_desatualizada";
    erro.concursoEncontrado = resultado?.concurso || null;
    erro.concursoMinimoEsperado = minimo;
    throw erro;
  }
  return resultado;
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
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

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

async function carregarBaseGitHub() {
  const dados = await fetchJson(GITHUB_DATA_URL);
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    throw new Error("Base histórica do GitHub em formato inesperado.");
  }
  return dados;
}

async function consultarGitHub(concurso = "") {
  const dados = await carregarBaseGitHub();
  const concursos = Object.keys(dados)
    .map(Number)
    .filter((numero) => Number.isInteger(numero) && numero > 0)
    .sort((a, b) => b - a);

  if (!concursos.length) throw new Error("Base histórica do GitHub sem concursos válidos.");

  const numero = concurso ? Number(concurso) : concursos[0];
  const dezenas = dados[String(numero)];
  if (!Array.isArray(dezenas)) throw new Error(`Concurso ${numero} não encontrado na base histórica.`);

  return criarResultadoGitHub(numero, dezenas);
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

  const resultado = {
    ...entrada.resultado,
    status: "cache",
    origemCache: true,
    cacheSalvoEm: new Date(entrada.salvoEm).toISOString(),
    mensagem: "Exibindo o último resultado válido armazenado em cache."
  };

  // O cache do último concurso nunca pode reintroduzir um resultado obsoleto.
  if (!concurso) validarAtualidade(resultado);
  return resultado;
}

async function consultarUltimoAtual() {
  const cacheValido = lerCache("");
  if (cacheValido) return cacheValido;

  const consultas = [
    consultarGuidi("").then((resultado) => ({ ok: true, resultado })).catch((erro) => ({ ok: false, fonte: "Guidi", erro })),
    consultarGitHub("").then((resultado) => ({ ok: true, resultado })).catch((erro) => ({ ok: false, fonte: "GitHub", erro }))
  ];

  const respostas = await Promise.all(consultas);
  const validos = respostas
    .filter((item) => item.ok)
    .map((item) => item.resultado)
    .sort((a, b) => Number(b.concurso) - Number(a.concurso));

  const falhas = respostas
    .filter((item) => !item.ok)
    .map((item) => `${item.fonte}: ${item.erro.message}`);

  for (const resultado of validos) {
    try {
      validarAtualidade(resultado);
      salvarCache(resultado, "");
      return resultado;
    } catch (erro) {
      falhas.push(`${resultado.fonte}: ${erro.message}`);
    }
  }

  const erro = new Error("Nenhuma fonte retornou um resultado suficientemente atual.");
  erro.tipo = "fontes_desatualizadas";
  erro.falhas = falhas;
  erro.concursoMinimoEsperado = obterConcursoMinimoEsperado();
  erro.maiorConcursoEncontrado = validos[0]?.concurso || null;
  throw erro;
}

async function consultarConcursoHistorico(concurso) {
  const cacheValido = lerCache(String(concurso));
  if (cacheValido) return cacheValido;

  const falhas = [];
  for (const consultar of [consultarGuidi, consultarGitHub]) {
    try {
      const resultado = await consultar(String(concurso));
      if (Number(resultado.concurso) !== Number(concurso)) {
        throw new Error(`A fonte retornou o concurso ${resultado.concurso} em vez de ${concurso}.`);
      }
      salvarCache(resultado, String(concurso));
      return resultado;
    } catch (erro) {
      falhas.push(`${consultar.name}: ${erro.message}`);
    }
  }

  const erro = new Error(`O concurso ${concurso} não foi encontrado.`);
  erro.tipo = "concurso_nao_encontrado";
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

  const valor = Array.isArray(req.query?.concurso) ? req.query.concurso[0] : req.query?.concurso;
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
    const ultimoResultado = await consultarUltimoAtual();

    if (!concursoSolicitado || concursoSolicitado === ultimoResultado.concurso) {
      return enviar(res, 200, ultimoResultado);
    }

    if (concursoSolicitado > ultimoResultado.concurso) {
      return enviar(res, 200, criarRespostaFuturo(ultimoResultado, concursoSolicitado));
    }

    const historico = await consultarConcursoHistorico(concursoSolicitado);
    return enviar(res, 200, historico);
  } catch (erro) {
    console.error("Falha na integração Lotofácil:", erro.message, erro.falhas || []);

    return enviar(res, 200, {
      status: erro.tipo === "fontes_desatualizadas" ? "desatualizado" : "indisponivel",
      tipo: erro.tipo || "fonte_indisponivel",
      erro: erro.tipo === "fontes_desatualizadas"
        ? "As fontes automáticas disponíveis estão desatualizadas."
        : "A consulta automática está temporariamente indisponível.",
      mensagem: "Para evitar uma conferência incorreta, nenhum resultado antigo foi carregado. Use a seleção manual.",
      manualMode: true,
      tentarNovamente: true,
      maiorConcursoEncontrado: erro.maiorConcursoEncontrado || null,
      concursoMinimoEsperado: erro.concursoMinimoEsperado || obterConcursoMinimoEsperado(),
      consultadoEm: new Date().toISOString()
    });
  }
};
