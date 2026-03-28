const { ethers } = window;

const CHAINS = {
  sepolia: {
    key: "sepolia",
    label: "Ethereum Sepolia",
    chainId: 11155111,
    chainIdHex: "0xaa36a7",
    rpcUrls: ["https://rpc.sepolia.org"],
    explorer: "https://sepolia.etherscan.io",
    nativeSymbol: "ETH",
    isArc: false,
  },
  arc: {
    key: "arc",
    label: "Arc Testnet",
    chainId: 5042002,
    chainIdHex: "0x4ceb92",
    rpcUrls: ["https://rpc.testnet.arc.network"],
    explorer: "https://testnet.arcscan.app",
    nativeSymbol: "USDC",
    isArc: true,
  },
};

const CCTP = {
  USDC_SEPOLIA: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  USDC_ARC: "0x3600000000000000000000000000000000000000",
  TOKEN_MESSENGER: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
  MESSAGE_TRANSMITTER: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
  DOMAIN_SEPOLIA: 0,
  DOMAIN_ARC: 26,
  IRIS_SANDBOX: "https://iris-api-sandbox.circle.com/v2/messages",
};

const UNISWAP = {
  ROUTER_V2_SEPOLIA: "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3",
  WETH_SEPOLIA: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
};

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

const UNISWAP_V2_ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
];

const TOKEN_MESSENGER_ABI = [
  "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold) external",
];

const MESSAGE_TRANSMITTER_ABI = [
  "function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)",
];

const STATE = {
  provider: null,
  signer: null,
  account: null,
  activeChain: null,
  bridgeDirection: "sepoliaToArc",
  busy: false,
};

const els = {
  connectBtn: document.getElementById("connectBtn"),
  switchNetworkBtn: document.getElementById("switchNetworkBtn"),
  networkPill: document.getElementById("networkPill"),
  swapNetwork: document.getElementById("swapNetwork"),
  ethBalance: document.getElementById("ethBalance"),
  sepoliaUsdcBalance: document.getElementById("sepoliaUsdcBalance"),
  swapAmount: document.getElementById("swapAmount"),
  swapSlippage: document.getElementById("swapSlippage"),
  swapQuote: document.getElementById("swapQuote"),
  refreshQuoteBtn: document.getElementById("refreshQuoteBtn"),
  swapBtn: document.getElementById("swapBtn"),
  swapLog: document.getElementById("swapLog"),
  bridgeDirectionLabel: document.getElementById("bridgeDirectionLabel"),
  fromNetworkLabel: document.getElementById("fromNetworkLabel"),
  toNetworkLabel: document.getElementById("toNetworkLabel"),
  bridgeBalance: document.getElementById("bridgeBalance"),
  destinationGasBalance: document.getElementById("destinationGasBalance"),
  bridgeAmount: document.getElementById("bridgeAmount"),
  bridgeSlippage: document.getElementById("bridgeSlippage"),
  invertBtn: document.getElementById("invertBtn"),
  bridgeBtn: document.getElementById("bridgeBtn"),
  bridgeLog: document.getElementById("bridgeLog"),
};

function short(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—";
}

function toBytes32Address(address) {
  return ethers.zeroPadValue(address, 32);
}

function currentBridgeSource() {
  return STATE.bridgeDirection === "sepoliaToArc" ? CHAINS.sepolia : CHAINS.arc;
}

function currentBridgeDestination() {
  return STATE.bridgeDirection === "sepoliaToArc" ? CHAINS.arc : CHAINS.sepolia;
}

function currentSourceTokenAddress() {
  return STATE.bridgeDirection === "sepoliaToArc" ? CCTP.USDC_SEPOLIA : CCTP.USDC_ARC;
}

function currentDestinationDomain() {
  return STATE.bridgeDirection === "sepoliaToArc" ? CCTP.DOMAIN_ARC : CCTP.DOMAIN_SEPOLIA;
}

function currentSourceDomain() {
  return STATE.bridgeDirection === "sepoliaToArc" ? CCTP.DOMAIN_SEPOLIA : CCTP.DOMAIN_ARC;
}

function formatUnitsSafe(value, decimals) {
  try {
    return Number(ethers.formatUnits(value, decimals)).toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    });
  } catch {
    return "0";
  }
}

function setBusy(value) {
  STATE.busy = value;
  [els.connectBtn, els.switchNetworkBtn, els.swapBtn, els.bridgeBtn, els.invertBtn, els.refreshQuoteBtn].forEach((el) => {
    el.disabled = value;
    el.style.opacity = value ? "0.7" : "1";
  });
}

function logTo(target, lines) {
  target.innerHTML = lines;
}

function buildExplorerLink(base, hash, label) {
  return `<a href="${base}/tx/${hash}" target="_blank" rel="noreferrer">${label}</a>`;
}

async function ensureWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask não encontrada.");
  }
  if (!STATE.provider) {
    STATE.provider = new ethers.BrowserProvider(window.ethereum);
  }
  return STATE.provider;
}

async function ensureConnected() {
  const provider = await ensureWallet();
  if (!STATE.account) {
    const accounts = await provider.send("eth_requestAccounts", []);
    if (!accounts?.length) {
      throw new Error("Nenhuma conta conectada.");
    }
    STATE.signer = await provider.getSigner();
    STATE.account = await STATE.signer.getAddress();
    await STATE.signer.signMessage("ARC Bridge login verification");
    els.connectBtn.textContent = short(STATE.account);
  }
  const network = await provider.getNetwork();
  STATE.activeChain = Number(network.chainId);
  updateNetworkPill();
  return provider;
}

function updateNetworkPill() {
  if (!STATE.account) {
    els.networkPill.textContent = "Rede não conectada";
    return;
  }
  const chain = Object.values(CHAINS).find((item) => item.chainId === STATE.activeChain);
  if (!chain) {
    els.networkPill.textContent = `Rede não suportada · ${STATE.activeChain}`;
    return;
  }
  els.networkPill.textContent = `${chain.label} · ${short(STATE.account)}`;
}

async function switchToChain(chain) {
  await ensureWallet();
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chain.chainIdHex }],
    });
  } catch (error) {
    if (error?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: chain.chainIdHex,
          chainName: chain.label,
          rpcUrls: chain.rpcUrls,
          nativeCurrency: {
            name: chain.nativeSymbol,
            symbol: chain.nativeSymbol,
            decimals: chain.isArc ? 18 : 18,
          },
          blockExplorerUrls: [chain.explorer],
        }],
      });
    } else {
      throw error;
    }
  }
  STATE.activeChain = chain.chainId;
  updateNetworkPill();
}

async function refreshBalances() {
  if (!STATE.account) {
    return;
  }

  const provider = await ensureWallet();
  const originalNetwork = Number((await provider.getNetwork()).chainId);
  STATE.activeChain = originalNetwork;
  updateNetworkPill();

  const sepoliaProvider = STATE.activeChain === CHAINS.sepolia.chainId
    ? provider
    : new ethers.JsonRpcProvider(CHAINS.sepolia.rpcUrls[0]);
  const arcProvider = STATE.activeChain === CHAINS.arc.chainId
    ? provider
    : new ethers.JsonRpcProvider(CHAINS.arc.rpcUrls[0]);

  const [ethBal, sepoliaUsdcBal, arcGasBal, arcUsdcBal] = await Promise.all([
    sepoliaProvider.getBalance(STATE.account),
    new ethers.Contract(CCTP.USDC_SEPOLIA, ERC20_ABI, sepoliaProvider).balanceOf(STATE.account),
    arcProvider.getBalance(STATE.account),
    new ethers.Contract(CCTP.USDC_ARC, ERC20_ABI, arcProvider).balanceOf(STATE.account).catch(() => 0n),
  ]);

  els.swapNetwork.textContent = originalNetwork === CHAINS.sepolia.chainId ? CHAINS.sepolia.label : originalNetwork === CHAINS.arc.chainId ? CHAINS.arc.label : `Chain ${originalNetwork}`;
  els.ethBalance.textContent = `${formatUnitsSafe(ethBal, 18)} ETH`;
  els.sepoliaUsdcBalance.textContent = `${formatUnitsSafe(sepoliaUsdcBal, 6)} USDC`;

  const sourceIsSepolia = STATE.bridgeDirection === "sepoliaToArc";
  const bridgeBalance = sourceIsSepolia ? sepoliaUsdcBal : arcUsdcBal;
  const bridgeDecimals = sourceIsSepolia ? 6 : 18;
  const destinationGas = sourceIsSepolia ? arcGasBal : ethBal;
  const destinationGasDecimals = sourceIsSepolia ? 18 : 18;
  const destinationGasSymbol = sourceIsSepolia ? "USDC gas" : "ETH gas";

  els.bridgeBalance.textContent = `${formatUnitsSafe(bridgeBalance, bridgeDecimals)} USDC`;
  els.destinationGasBalance.textContent = `${formatUnitsSafe(destinationGas, destinationGasDecimals)} ${destinationGasSymbol}`;
}

async function connectWallet() {
  try {
    setBusy(true);
    await ensureConnected();
    await refreshBalances();
    logTo(els.swapLog, "Carteira conectada e mensagem assinada com sucesso.");
    logTo(els.bridgeLog, "Carteira conectada e pronta para bridge.");
  } catch (error) {
    logTo(els.swapLog, `Erro ao conectar: ${error.message || error}`);
    logTo(els.bridgeLog, `Erro ao conectar: ${error.message || error}`);
  } finally {
    setBusy(false);
  }
}

async function manualNetworkSwitch() {
  try {
    await ensureConnected();
    const target = STATE.activeChain === CHAINS.sepolia.chainId ? CHAINS.arc : CHAINS.sepolia;
    await switchToChain(target);
    await refreshBalances();
  } catch (error) {
    logTo(els.swapLog, `Erro ao trocar rede: ${error.message || error}`);
  }
}

async function quoteSwap() {
  try {
    await ensureConnected();
    const amountValue = els.swapAmount.value;
    if (!amountValue || Number(amountValue) <= 0) {
      els.swapQuote.textContent = "—";
      return;
    }
    const provider = await ensureWallet();
    const network = Number((await provider.getNetwork()).chainId);
    if (network !== CHAINS.sepolia.chainId) {
      await switchToChain(CHAINS.sepolia);
    }

    const router = new ethers.Contract(UNISWAP.ROUTER_V2_SEPOLIA, UNISWAP_V2_ROUTER_ABI, provider);
    const amountIn = ethers.parseEther(amountValue);
    const result = await router.getAmountsOut(amountIn, [UNISWAP.WETH_SEPOLIA, CCTP.USDC_SEPOLIA]);
    const out = result?.[1] ?? 0n;
    els.swapQuote.textContent = `${formatUnitsSafe(out, 6)} USDC`;
  } catch (error) {
    els.swapQuote.textContent = "Sem cotação";
    logTo(els.swapLog, `Não foi possível cotar agora. Verifique liquidez do par ETH/USDC na Sepolia.\n\nDetalhe: ${error.message || error}`);
  }
}

async function executeSwap() {
  try {
    setBusy(true);
    await ensureConnected();
    if (STATE.activeChain !== CHAINS.sepolia.chainId) {
      await switchToChain(CHAINS.sepolia);
    }

    const amountValue = els.swapAmount.value;
    if (!amountValue || Number(amountValue) <= 0) {
      throw new Error("Informe a quantidade de ETH.");
    }

    const slippage = Number(els.swapSlippage.value || "0.5");
    const amountIn = ethers.parseEther(amountValue);
    const provider = await ensureWallet();
    const signer = await provider.getSigner();
    const routerRead = new ethers.Contract(UNISWAP.ROUTER_V2_SEPOLIA, UNISWAP_V2_ROUTER_ABI, provider);
    const quoted = await routerRead.getAmountsOut(amountIn, [UNISWAP.WETH_SEPOLIA, CCTP.USDC_SEPOLIA]);
    const expectedOut = quoted?.[1] ?? 0n;
    if (expectedOut <= 0n) {
      throw new Error("Sem saída válida para esse swap.");
    }

    const bps = BigInt(Math.round(slippage * 100));
    const amountOutMin = expectedOut * (10000n - bps) / 10000n;
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const routerWrite = new ethers.Contract(UNISWAP.ROUTER_V2_SEPOLIA, UNISWAP_V2_ROUTER_ABI, signer);
    logTo(els.swapLog, `Enviando swap real na Uniswap...\nEsperado: ${formatUnitsSafe(expectedOut, 6)} USDC\nMínimo com slippage: ${formatUnitsSafe(amountOutMin, 6)} USDC`);

    const tx = await routerWrite.swapExactETHForTokens(
      amountOutMin,
      [UNISWAP.WETH_SEPOLIA, CCTP.USDC_SEPOLIA],
      STATE.account,
      deadline,
      { value: amountIn }
    );

    logTo(els.swapLog, `Transação enviada.\n${buildExplorerLink(CHAINS.sepolia.explorer, tx.hash, "Ver no explorer")}`);
    await tx.wait();
    await refreshBalances();
    await quoteSwap();
    logTo(els.swapLog, `Swap concluído com sucesso.\n${buildExplorerLink(CHAINS.sepolia.explorer, tx.hash, "Abrir transação")}`);
  } catch (error) {
    logTo(els.swapLog, `Erro no swap: ${error.message || error}`);
  } finally {
    setBusy(false);
  }
}

function updateBridgeDirectionUI() {
  const source = currentBridgeSource();
  const destination = currentBridgeDestination();
  els.bridgeDirectionLabel.textContent = `Bridge ${source.label} → ${destination.label} (USDC)`;
  els.fromNetworkLabel.textContent = source.label;
  els.toNetworkLabel.textContent = destination.label;
}

function invertDirection() {
  STATE.bridgeDirection = STATE.bridgeDirection === "sepoliaToArc" ? "arcToSepolia" : "sepoliaToArc";
  updateBridgeDirectionUI();
  refreshBalances().catch(() => {});
}

async function getUsdcDecimalsForSource(provider, tokenAddress) {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  try {
    return Number(await contract.decimals());
  } catch {
    return tokenAddress.toLowerCase() === CCTP.USDC_SEPOLIA.toLowerCase() ? 6 : 18;
  }
}

async function ensureAllowanceIfNeeded(provider, tokenAddress, spender, amount, decimals, logTarget) {
  const signer = await provider.getSigner();
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const allowance = await token.allowance(STATE.account, spender);
  if (allowance >= amount) {
    return;
  }
  logTo(logTarget, `Aprovando USDC para a bridge...`);
  const approveTx = await token.approve(spender, amount);
  logTo(logTarget, `Aprovação enviada.\n${buildExplorerLink(currentBridgeSource().explorer, approveTx.hash, "Ver aprovação")}`);
  await approveTx.wait();
}

async function pollAttestation(sourceDomain, burnTxHash, logTarget) {
  const url = `${CCTP.IRIS_SANDBOX}/${sourceDomain}?transactionHash=${burnTxHash}`;
  while (true) {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const entry = data?.messages?.[0];
      if (entry?.status === "complete") {
        logTo(logTarget, `Attestation pronta.\nMensagem validada pela Circle.`);
        return entry;
      }
    }
    logTo(logTarget, `Aguardando attestation da Circle...\nIsso pode levar alguns segundos.`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

async function executeBridge() {
  try {
    setBusy(true);
    await ensureConnected();
    const source = currentBridgeSource();
    const destination = currentBridgeDestination();
    await switchToChain(source);

    const provider = await ensureWallet();
    const signer = await provider.getSigner();
    const tokenAddress = currentSourceTokenAddress();
    const amountValue = els.bridgeAmount.value;
    if (!amountValue || Number(amountValue) <= 0) {
      throw new Error("Informe a quantidade de USDC para bridge.");
    }

    const decimals = await getUsdcDecimalsForSource(provider, tokenAddress);
    const amount = ethers.parseUnits(amountValue, decimals);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await token.balanceOf(STATE.account);
    if (balance < amount) {
      throw new Error("Saldo insuficiente para a bridge.");
    }

    await ensureAllowanceIfNeeded(provider, tokenAddress, CCTP.TOKEN_MESSENGER, amount, decimals, els.bridgeLog);

    const messenger = new ethers.Contract(CCTP.TOKEN_MESSENGER, TOKEN_MESSENGER_ABI, signer);
    const destinationAddressBytes32 = toBytes32Address(STATE.account);
    const destinationCaller = ethers.ZeroHash;
    const maxFee = 500n;
    const finalityThreshold = 1000;

    logTo(els.bridgeLog, `Queimando USDC na origem...\nOrigem: ${source.label}\nDestino: ${destination.label}`);
    const burnTx = await messenger.depositForBurn(
      amount,
      currentDestinationDomain(),
      destinationAddressBytes32,
      tokenAddress,
      destinationCaller,
      maxFee,
      finalityThreshold
    );

    logTo(els.bridgeLog, `Burn enviado.\n${buildExplorerLink(source.explorer, burnTx.hash, "Ver burn no explorer")}`);
    await burnTx.wait();

    const attestation = await pollAttestation(currentSourceDomain(), burnTx.hash, els.bridgeLog);

    await switchToChain(destination);
    const destProvider = await ensureWallet();
    const destSigner = await destProvider.getSigner();
    const transmitter = new ethers.Contract(CCTP.MESSAGE_TRANSMITTER, MESSAGE_TRANSMITTER_ABI, destSigner);

    logTo(els.bridgeLog, `Mintando USDC no destino...\nConfirme a transação na carteira.`);
    const mintTx = await transmitter.receiveMessage(attestation.message, attestation.attestation);
    logTo(els.bridgeLog, `Mint enviado.\n${buildExplorerLink(destination.explorer, mintTx.hash, "Ver mint no explorer")}`);
    await mintTx.wait();

    await refreshBalances();
    logTo(els.bridgeLog, `Bridge concluída com sucesso.\n${buildExplorerLink(destination.explorer, mintTx.hash, "Abrir transação final")}`);
  } catch (error) {
    logTo(els.bridgeLog, `Erro na bridge: ${error.message || error}`);
  } finally {
    setBusy(false);
  }
}

els.connectBtn.addEventListener("click", connectWallet);
els.switchNetworkBtn.addEventListener("click", manualNetworkSwitch);
els.refreshQuoteBtn.addEventListener("click", quoteSwap);
els.swapBtn.addEventListener("click", executeSwap);
els.invertBtn.addEventListener("click", invertDirection);
els.bridgeBtn.addEventListener("click", executeBridge);
els.swapAmount.addEventListener("input", () => {
  window.clearTimeout(window.__swapQuoteDebounce);
  window.__swapQuoteDebounce = window.setTimeout(() => {
    quoteSwap().catch(() => {});
  }, 350);
});

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}

updateBridgeDirectionUI();
logTo(els.swapLog, "Conecte a carteira para ver seus saldos e fazer o swap real.");
logTo(els.bridgeLog, "Conecte a carteira para iniciar a bridge real entre Sepolia e Arc Testnet.");
