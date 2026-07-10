const FONTES_OFICIAIS = [
  "https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil",
  "https://servicebus3.caixa.gov.br/portaldeloterias/api/lotofacil"
];
const API_PUBLICA_BASE = "https://loteriascaixa-api.herokuapp.com/api/lotofacil";
const APOSTA_MINIMA = 3.5;
const TIMEOUT_MS = 15000;

function somenteNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function normalizarDezenas(valor) {
  if (!Array.isArray(valor)) return [];

  return [...new Set(
    valor
      .map((dezena) => Number(String(dezena).replace(/\D/g, "")))
      .filter((dezena) => Number.isInteger(dezena) && dezena >= 1 && dezena <= 25)
  )].sort((a, b) => a - b);
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
      ganhadores: somenteNumero(faixa?.numeroDeGanhadores ?? faixa?.ganhadores ?? faixa?.vencedores),
      valor: somenteNumero(faixa?.valorPremio ?? faixa?.premio ?? faixa?.valor)
    };
  });
}

function normalizarResultado(dados, fonte) {
  const concurso = Number(dados?.numero ?? dados?.concurso);
  const dezenas = normalizarDezenas(
    dados?.listaDezenas ??
    dados?.dezenas ??
    dados?.dezenasSorteadasOrdemSorteio ??
    dados?.listaDezenasOrdemSorteio
  );

  if (!Number.isInteger(concurso) || concurso <= 0 || dezenas.length !== 15) {
    throw new Error("A fonte consultada não retornou um concurso válido com 15 dezenas.");
  }

  return {
    status: "apurado",
    tipo: "resultado_oficial",
    concurso,
    data: dados?.dataApuracao ?? dados?.data ?? null,
    dezenas,
    acumulado: Boolean(dados?.acumulado ?? dados?.acumulou),
    proximoConcurso: Number(dados?.numeroConcursoProximo ?? dados?.proximoConcurso ?? concurso + 1),
    dataProximoConcurso: dados?.dataProximoConcurso ?? null,
    horarioProximoConcurso: dados?.horarioProximoConcurso ?? "21h",
    estimativaProximoConcurso: somenteNumero(
      dados?.valorEstimadoProximoConcurso ?? dados?.valorEstimadoProximoConcursoFinal
    ),
    valorApostaMinima: APOSTA_MINIMA,
    premiacao: normalizarPremiacao(dados),
    fonte,
    consultadoEm: new Date().toISOString()
  };
}

function criarRespostaConcursoFuturo(ultimoResultado, concursoSolicitado) {
  const solicitado = Number(concursoSolicitado);
  const proximoOficial = Number(ultimoResultado.proximoConcurso || ultimoResultado.concurso + 1);

  return {
    status: "futuro",
    tipo: "proximo_concurso",
    concursoSolicitado: solicitado,
    proximoConcurso: solicitado >= proximoOficial ? solicitado : proximoOficial,
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

async function lerJsonSeguro(resposta) {
  const texto = await resposta.text();

  if (!resposta.ok) {
    throw new Error(`HTTP ${resposta.status}`);
  }

  try {
    return JSON.parse(texto.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(`A fonte retornou conteúdo inválido (${resposta.status}).`);
  }
}

async function buscarComTimeout(url, headers = {}) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const resposta = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "pt-BR,pt;q=0.9",
        ...headers
      },
      redirect: "follow",
      signal: controlador.signal
    });

    return await lerJsonSeguro(resposta);
  } finally {
    clearTimeout(temporizador);
  }
}

async function consultarFonteOficial(base, concurso = "") {
  const url = concurso ? `${base}/${encodeURIComponent(concurso)}` : base;
  const dados = await buscarComTimeout(url, {
    Referer: "https://loterias.caixa.gov.br/",
    Origin: "https://loterias.caixa.gov.br",
    "User-Agent": "Mozilla/5.0 (compatible; Gerador-Inteligente-Lotofacil/2.3.3)"
  });
  return normalizarResultado(dados, "Portal Loterias CAIXA");
}

async function consultarFontePublica(concurso = "") {
  const url = concurso
    ? `${API_PUBLICA_BASE}/${encodeURIComponent(concurso)}`
    : `${API_PUBLICA_BASE}/latest`;
  const dados = await buscarComTimeout(url);
  return normalizarResultado(dados, "API pública Loterias CAIXA");
}

async function consultarTodasAsFontes(concurso = "") {
  const tentativas = [
    ...FONTES_OFICIAIS.map((fonte) => () => consultarFonteOficial(fonte, concurso)),
    () => consultarFontePublica(concurso)
  ];
  const resultados = [];
  const falhas = [];

  for (const tentativa of tentativas) {
    try {
      resultados.push(await tentativa());
    } catch (erro) {
      falhas.push(erro.message);
    }
  }

  if (!resultados.length) {
    const erro = new Error("Nenhuma fonte retornou resultado válido.");
    erro.falhas = falhas;
    throw erro;
  }

  return resultados.sort((a, b) => Number(b.concurso) - Number(a.concurso))[0];
}

function enviar(res, codigo, corpo) {
  res.status(codigo).json(corpo);
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return enviar(res, 405, {
      status: "erro",
      tipo: "metodo_nao_permitido",
      erro: "Método não permitido."
    });
  }

  const valorRecebido = Array.isArray(req.query?.concurso)
    ? req.query.concurso[0]
    : req.query?.concurso;
  const concursoTexto = valorRecebido
    ? String(valorRecebido).replace(/\D/g, "")
    : "";
  const concursoSolicitado = concursoTexto ? Number(concursoTexto) : null;

  if (concursoTexto && (!Number.isInteger(concursoSolicitado) || concursoSolicitado <= 0)) {
    return enviar(res, 400, {
      status: "erro",
      tipo: "concurso_invalido",
      erro: "Informe um número de concurso válido."
    });
  }

  try {
    const ultimoResultado = await consultarTodasAsFontes();

    if (!concursoSolicitado) {
      return enviar(res, 200, ultimoResultado);
    }

    if (concursoSolicitado === ultimoResultado.concurso) {
      return enviar(res, 200, ultimoResultado);
    }

    if (concursoSolicitado > ultimoResultado.concurso) {
      return enviar(res, 200, criarRespostaConcursoFuturo(ultimoResultado, concursoSolicitado));
    }

    try {
      const resultadoHistorico = await consultarTodasAsFontes(String(concursoSolicitado));
      return enviar(res, 200, resultadoHistorico);
    } catch {
      return enviar(res, 404, {
        status: "erro",
        tipo: "concurso_nao_encontrado",
        concursoSolicitado,
        ultimoConcursoApurado: ultimoResultado.concurso,
        erro: `O concurso ${concursoSolicitado} não foi encontrado. Verifique o número informado.`
      });
    }
  } catch (erro) {
    console.error("Falha na integração Lotofácil:", erro.message, erro.falhas || []);

    return enviar(res, 503, {
      status: "indisponivel",
      tipo: "fonte_indisponivel",
      erro: "A consulta automática está temporariamente indisponível.",
      mensagem: "Você pode continuar usando a seleção e a conferência manual.",
      tentarNovamente: true,
      detalhes: process.env.NODE_ENV === "development" ? erro.falhas : undefined
    });
  }
};
