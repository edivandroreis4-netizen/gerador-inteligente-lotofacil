export function gerarJogo(quantidade = 15) {
  const numeros = Array.from({ length: 25 }, (_, index) => index + 1);
  const jogo = [];

  while (jogo.length < quantidade) {
    const indiceAleatorio = Math.floor(Math.random() * numeros.length);
    const numeroSorteado = numeros.splice(indiceAleatorio, 1)[0];
    jogo.push(numeroSorteado);
  }

  return ordenarNumeros(jogo);
}

export function ordenarNumeros(numeros) {
  return [...numeros].sort((a, b) => a - b);
}
