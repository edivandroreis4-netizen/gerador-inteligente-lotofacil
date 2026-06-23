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
