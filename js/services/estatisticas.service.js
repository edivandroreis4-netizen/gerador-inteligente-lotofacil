export function contarParesImpares(numeros) {
  const pares = numeros.filter((numero) => numero % 2 === 0).length;
  return { pares, impares: numeros.length - pares };
}

export function conferirAcertos(jogo, resultadoOficial) {
  const resultadoSet = new Set(resultadoOficial);
  const acertados = jogo.filter((numero) => resultadoSet.has(numero));
  const errados = jogo.filter((numero) => !resultadoSet.has(numero));

  return {
    total: acertados.length,
    acertados,
    errados,
    faltaram: 15 - acertados.length
  };
}

export function obterMelhorResultado(historico) {
  return historico.reduce((maior, item) => Math.max(maior, item.acertos || 0), 0);
}

export function contarJogosPremiaveis(historico) {
  return historico.filter((item) => (item.acertos || 0) >= 11).length;
}

export function contarAcertosPorFaixa(historico) {
  const faixas = { "0-10": 0, "11": 0, "12": 0, "13": 0, "14": 0, "15": 0 };

  historico.forEach((item) => {
    const acertos = item.acertos || 0;
    if (acertos <= 10) faixas["0-10"] += 1;
    if (acertos >= 11 && acertos <= 15) faixas[String(acertos)] += 1;
  });

  return faixas;
}

function calcularFaixas(numeros) {
  const faixas = [0, 0, 0, 0, 0];
  numeros.forEach((numero) => {
    const indice = Math.ceil(numero / 5) - 1;
    faixas[indice] += 1;
  });
  return faixas;
}

function maiorSequencia(numeros) {
  const ordenados = [...numeros].sort((a, b) => a - b);
  let atual = 1;
  let maior = 1;

  for (let i = 1; i < ordenados.length; i += 1) {
    if (ordenados[i] === ordenados[i - 1] + 1) {
      atual += 1;
      maior = Math.max(maior, atual);
    } else {
      atual = 1;
    }
  }

  return maior;
}

export function avaliarQualidadeJogo(numeros) {
  if (!numeros.length) {
    return { pontos: 0, classificacao: "Aguardando jogo", emoji: "⚪" };
  }

  const { pares, impares } = contarParesImpares(numeros);
  const soma = numeros.reduce((total, numero) => total + numero, 0);
  const faixas = calcularFaixas(numeros);
  const sequencia = maiorSequencia(numeros);

  let pontos = 100;

  if (![7, 8].includes(pares)) pontos -= Math.abs(pares - 7.5) * 5;
  if (soma < 180 || soma > 220) pontos -= Math.min(18, Math.abs(soma - 200) * 0.6);
  if (faixas.some((qtd) => qtd === 0)) pontos -= 14;
  if (faixas.some((qtd) => qtd >= 6)) pontos -= 10;
  if (sequencia >= 5) pontos -= 10;
  if (sequencia === 4) pontos -= 5;

  pontos = Math.max(0, Math.min(100, Math.round(pontos)));

  if (pontos >= 85) return { pontos, classificacao: "Excelente", emoji: "🟢", detalhes: { pares, impares, soma, faixas, sequencia } };
  if (pontos >= 70) return { pontos, classificacao: "Boa", emoji: "🟡", detalhes: { pares, impares, soma, faixas, sequencia } };
  return { pontos, classificacao: "Baixa", emoji: "🔴", detalhes: { pares, impares, soma, faixas, sequencia } };
}

export function calcularAtrasosNumeros(resultados) {
  const ordenados = [...resultados].sort((a, b) => {
    const na = Number(a.concurso);
    const nb = Number(b.concurso);
    if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na;
    return new Date(b.dataRegistro || 0) - new Date(a.dataRegistro || 0);
  });

  return Array.from({ length: 25 }, (_, indice) => {
    const numero = indice + 1;
    const ultimaPosicao = ordenados.findIndex((resultado) => resultado.numeros.includes(numero));
    return {
      numero,
      atraso: ultimaPosicao === -1 ? ordenados.length : ultimaPosicao,
      nuncaEncontrado: ultimaPosicao === -1
    };
  }).sort((a, b) => b.atraso - a.atraso || a.numero - b.numero);
}
