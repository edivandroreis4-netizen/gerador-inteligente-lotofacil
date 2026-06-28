const FONTES_OFICIAIS = [
  "https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil",
  "https://servicebus3.caixa.gov.br/portaldeloterias/api/lotofacil"
];

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

function normalizarResultado(dados) {
  const concurso = Number(dados?.numero ?? dados?.concurso);
  const dezenas = normalizarDezenas(
    dados?.listaDezenas ?? dados?.dezenas ?? dados?.listaDezenasOrdemSorteio
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
    acumulado: Boolean(dados?.acumulado),
    proximoConcurso: dados?.numeroConcursoProximo
      ? Number(dados.numeroConcursoProximo)
      : concurso + 1,
    dataProximoConcurso: dados?.dataProximoConcurso ?? null,
    horarioProximoConcurso: dados?.horarioProximoConcurso ?? "21h",
    estimativaProximoConcurso: somenteNumero(
      dados?.valorEstimadoProximoConcurso ?? dados?.valorEstimadoProximoConcursoFinal
    ),
    valorApostaMinima: APOSTA_MINIMA,
    premiacao: Array.isArray(dados?.listaRateioPremio)
      ? dados.listaRateioPremio.map((faixa) => ({
          descricao: faixa?.descricaoFaixa ?? null,
          ganhadores: somenteNumero(faixa?.numeroDeGanhadores),
          valor: somenteNumero(faixa?.valorPremio)
        }))
      : [],
    fonte: "Portal Loterias CAIXA",
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

  try {
    return JSON.parse(texto.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(`A fonte retornou conteúdo inválido (${resposta.status}).`);
  }
}

async function consultarFonte(base, concurso = "") {
  const url = concurso ? `${base}/${encodeURIComponent(concurso)}` : base;
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const resposta = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "pt-BR,pt;q=0.9",
        Referer: "https://loterias.caixa.gov.br/",
        Origin: "https://loterias.caixa.gov.br",
        "User-Agent": "Mozilla/5.0 (compatible; Gerador-Inteligente-Lotofacil/2.3.2)"
      },
      redirect: "follow",
      signal: controlador.signal
    });

    if (!resposta.ok) {
      throw new Error(`A fonte respondeu HTTP ${resposta.status}.`);
    }

    return normalizarResultado(await lerJsonSeguro(resposta));
  } finally {
    clearTimeout(temporizador);
  }
}

async function consultarFontes(concurso = "") {
  const falhas = [];

  for (const fonte of FONTES_OFICIAIS) {
    try {
      return await consultarFonte(fonte, concurso);
    } catch (erro) {
      falhas.push(`${new URL(fonte).hostname}: ${erro.message}`);
    }
  }

  const erro = new Error("As fontes oficiais não responderam corretamente.");
  erro.falhas = falhas;
  throw erro;
}

function enviar(res, codigo, corpo) {
  res.status(codigo).json(corpo);
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");

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
    // Primeiro consulta sempre o último concurso apurado. Isso permite distinguir
    // corretamente um concurso futuro de uma falha real da integração.
    const ultimoResultado = await consultarFontes();

    if (!concursoSolicitado || concursoSolicitado === ultimoResultado.concurso) {
      return enviar(res, 200, ultimoResultado);
    }

    if (concursoSolicitado > ultimoResultado.concurso) {
      return enviar(
        res,
        200,
        criarRespostaConcursoFuturo(ultimoResultado, concursoSolicitado)
      );
    }

    // Apenas concursos anteriores precisam de uma segunda consulta específica.
    try {
      const resultadoHistorico = await consultarFontes(String(concursoSolicitado));
      return enviar(res, 200, resultadoHistorico);
    } catch (erroHistorico) {
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
      erro: "A consulta oficial está temporariamente indisponível.",
      mensagem: "Você pode continuar usando a seleção e a conferência manual.",
      tentarNovamente: true,
      detalhes: process.env.NODE_ENV === "development" ? erro.falhas : undefined
    });
  }
};
