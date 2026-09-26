# Montagem de Polaroids A4

Site estático para montar quatro fotos com uma das três molduras e baixar uma folha A4 em PDF. Todo o processamento acontece no navegador; as fotos escolhidas não são enviadas a um servidor.

## Abrir no computador

Abra `index.html` no navegador. Não é preciso iniciar servidor nem instalar dependências. As três molduras também estão incorporadas em `frames-data.js`, o que permite gerar o PDF diretamente ao abrir o arquivo local. Para publicar depois, basta hospedar os arquivos como site estático; não há etapa de compilação.

## Impressão

O PDF tem uma página A4 em retrato, com quatro posições de 105 × 148,5 mm. Cada posição é renderizada em 1240 × 1754 pixels (aproximadamente 300 dpi) e compactada em JPEG com qualidade de 97%. Cada moldura ocupa todo o seu quadrante. O aplicativo ignora a margem praticamente transparente e a sombra inferior dos PNGs, preservando a moldura. A moldura é ajustada à proporção do papel; as fotos mantêm a proporção original. Ao imprimir, use papel A4 e escala de 100%.

As imagens originais continuam na raiz da pasta. As cópias em `assets/` usam nomes curtos para facilitar a publicação.
