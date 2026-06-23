export function normalizarNumeros(texto) {
  return texto
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(Number);
}

export function validarAposta(numeros, quantidade = 15) {
  if (!Array.isArray(numeros)) {
    return { valido: false, mensagem: "Informe uma lista de números válida." };
  }

  if (numeros.length !== quantidade) {
    return { valido: false, mensagem: `Informe exatamente ${quantidade} números.` };
  }

  const possuiNumeroInvalido = numeros.some((numero) => numero < 1 || numero > 25 || !Number.isInteger(numero));
  if (possuiNumeroInvalido) {
    return { valido: false, mensagem: "Os números precisam estar entre 1 e 25." };
  }

  const numerosUnicos = new Set(numeros);
  if (numerosUnicos.size !== numeros.length) {
    return { valido: false, mensagem: "Não pode haver números repetidos." };
  }

  return { valido: true, mensagem: "Aposta válida." };
}
