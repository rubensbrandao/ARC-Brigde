ARC Bridge Premium

Arquivos:
- index.html
- styles.css
- app.js
- logo.webp
- banner-top.webp
- banner-swap.webp
- banner-bridge.webp

Como usar:
1. Suba a pasta inteira no GitHub Pages, Vercel ou Netlify.
2. Mantenha os arquivos na mesma pasta.
3. Abra index.html em um servidor estático.

Observações:
- Swap: usa Uniswap V2 Router na Sepolia.
- Bridge: usa CCTP sandbox (Circle) entre Ethereum Sepolia e Arc Testnet.
- A carteira assina uma mensagem ao conectar.
- A direção da bridge é fixa Sepolia -> Arc, com botão para inverter.
- O campo de slippage do bloco da bridge é visual; o CCTP não usa slippage como uma swap.
- Na Arc, o gas é pago em USDC nativo.
