import { useEffect, useMemo, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { BridgeKit } from '@circle-fin/bridge-kit'
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2'
import {
  createPublicClient,
  custom,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
  type Address,
} from 'viem'
import { useAccount, useDisconnect, useSwitchChain } from 'wagmi'
import { sepolia } from 'viem/chains'

type AppChain = 'Ethereum_Sepolia' | 'Arc_Testnet'

type StatusTone = 'neutral' | 'success' | 'error'

const ARC_CHAIN_ID = 5042002
const ARC_WALLET_CHAIN_ID_HEX = '0x4CEB72'
const ARC_CHAIN = {
  id: ARC_CHAIN_ID,
  name: 'Arc Testnet',
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' },
  },
}

const CHAIN_META: Record<AppChain, {
  key: AppChain
  label: string
  chainId: number
  bridgeKey: AppChain
  usdc: Address
  explorer: string
  gasLabel: string
  faucetUrl: string
}> = {
  Ethereum_Sepolia: {
    key: 'Ethereum_Sepolia',
    label: 'Sepolia',
    chainId: sepolia.id,
    bridgeKey: 'Ethereum_Sepolia',
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    explorer: 'https://sepolia.etherscan.io',
    gasLabel: 'ETH',
    faucetUrl: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia',
  },
  Arc_Testnet: {
    key: 'Arc_Testnet',
    label: 'Arc Testnet',
    chainId: ARC_CHAIN_ID,
    bridgeKey: 'Arc_Testnet',
    usdc: '0x3600000000000000000000000000000000000000',
    explorer: 'https://testnet.arcscan.app',
    gasLabel: 'USDC',
    faucetUrl: 'https://faucet.circle.com',
  },
}

const USDC_DECIMALS: Record<AppChain, number> = {
  Ethereum_Sepolia: 6,
  Arc_Testnet: 18,
}

const bridgeKit = new BridgeKit()

function trimAddress(value?: string) {
  if (!value) return 'Not connected'
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

async function ensureArcNetwork() {
  const provider = (window as Window & { ethereum?: any }).ethereum
  if (!provider) return
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_WALLET_CHAIN_ID_HEX }],
    })
  } catch (error: any) {
    if (error?.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: ARC_WALLET_CHAIN_ID_HEX,
            chainName: 'Arc Testnet',
            rpcUrls: ['https://rpc.testnet.arc.network'],
            nativeCurrency: {
              name: 'USDC',
              symbol: 'USDC',
              decimals: 18,
            },
            blockExplorerUrls: ['https://testnet.arcscan.app'],
          },
        ],
      })
    } else {
      throw error
    }
  }
}

function getClient(chain: AppChain) {
  if (chain === 'Ethereum_Sepolia') {
    return createPublicClient({ chain: sepolia, transport: http() })
  }

  return createPublicClient({
    chain: {
      id: ARC_CHAIN.id,
      name: ARC_CHAIN.name,
      nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
      rpcUrls: ARC_CHAIN.rpcUrls,
      blockExplorers: ARC_CHAIN.blockExplorers,
      testnet: true,
    },
    transport: http('https://rpc.testnet.arc.network'),
  })
}

export default function App() {
  const { address, chainId, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()

  const [fromChain, setFromChain] = useState<AppChain>('Ethereum_Sepolia')
  const [toChain, setToChain] = useState<AppChain>('Arc_Testnet')
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState('0.50')
  const [status, setStatus] = useState('Ready to swap on Sepolia or bridge native USDC to Arc.')
  const [statusTone, setStatusTone] = useState<StatusTone>('neutral')
  const [busy, setBusy] = useState(false)
  const [bridgeTxUrl, setBridgeTxUrl] = useState<string | null>(null)
  const [balances, setBalances] = useState<Record<AppChain, string>>({
    Ethereum_Sepolia: '0.00',
    Arc_Testnet: '0.00',
  })

  const currentNetworkLabel = useMemo(() => {
    if (chainId === sepolia.id) return 'Sepolia'
    if (chainId === ARC_CHAIN_ID) return 'Arc Testnet'
    return 'Unsupported network'
  }, [chainId])

  const activeBalance = balances[fromChain]
  const canBridge = isConnected && Number(amount) > 0 && Number(activeBalance || 0) >= Number(amount)

  const syncDirectionWithWallet = async () => {
    if (!chainId) return
    if (chainId === sepolia.id && fromChain !== 'Ethereum_Sepolia') {
      setFromChain('Ethereum_Sepolia')
      setToChain('Arc_Testnet')
    }
    if (chainId === ARC_CHAIN_ID && fromChain !== 'Arc_Testnet') {
      setFromChain('Arc_Testnet')
      setToChain('Ethereum_Sepolia')
    }
  }

  const refreshBalances = async () => {
    if (!address) return

    try {
      const [sepoliaBalance, arcBalance] = await Promise.all([
        getClient('Ethereum_Sepolia').readContract({
          address: CHAIN_META.Ethereum_Sepolia.usdc,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        }),
        getClient('Arc_Testnet').readContract({
          address: CHAIN_META.Arc_Testnet.usdc,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        }),
      ])

      setBalances({
        Ethereum_Sepolia: Number(formatUnits(sepoliaBalance, USDC_DECIMALS.Ethereum_Sepolia)).toFixed(2),
        Arc_Testnet: Number(formatUnits(arcBalance, USDC_DECIMALS.Arc_Testnet)).toFixed(2),
      })
    } catch {
      setBalances({
        Ethereum_Sepolia: '0.00',
        Arc_Testnet: '0.00',
      })
    }
  }

  useEffect(() => {
    void syncDirectionWithWallet()
  }, [chainId])

  useEffect(() => {
    void refreshBalances()
  }, [address, chainId])

  const handleInvert = () => {
    setFromChain(toChain)
    setToChain(fromChain)
    setStatus('Direction inverted. The wallet network will be switched automatically when you bridge.')
    setStatusTone('neutral')
  }

  const handleAutoSwitch = async (targetChain: AppChain) => {
    if (targetChain === 'Ethereum_Sepolia') {
      await switchChainAsync({ chainId: sepolia.id })
      return
    }

    await ensureArcNetwork()
    await switchChainAsync({ chainId: ARC_CHAIN_ID })
  }

  const handleBridge = async () => {
    const provider = (window as Window & { ethereum?: any }).ethereum
    if (!provider || !address) {
      setStatus('Connect your wallet first.')
      setStatusTone('error')
      return
    }

    try {
      setBusy(true)
      setStatusTone('neutral')
      setStatus('Switching wallet network...')
      setBridgeTxUrl(null)

      await handleAutoSwitch(fromChain)

      setStatus('Preparing bridge transaction...')

      const adapter = createViemAdapterFromProvider({
        provider,
        getWalletClient: ({ chain }: { chain: { id: number } }) =>
          Promise.resolve(
            undefined as never,
          ),
      })

      const result = await bridgeKit.bridge({
        from: { adapter, chain: CHAIN_META[fromChain].bridgeKey },
        to: { adapter, chain: CHAIN_META[toChain].bridgeKey },
        amount,
      })

      const txHash = result?.sourceTxHash ?? result?.txHash ?? result?.transactionHash ?? null
      if (txHash) {
        setBridgeTxUrl(`${CHAIN_META[fromChain].explorer}/tx/${txHash}`)
      }

      setStatus('Bridge submitted. Wait for burn, attestation, and mint to finish.')
      setStatusTone('success')
      await refreshBalances()
    } catch (error: any) {
      const message = error?.shortMessage || error?.message || 'Bridge failed.'
      setStatus(message)
      setStatusTone('error')
    } finally {
      setBusy(false)
    }
  }

  const getSwapUrl = () => {
    const rawAmount = amount && Number(amount) > 0 ? amount : ''
    const query = new URLSearchParams({
      chain: 'sepolia',
      inputCurrency: 'ETH',
      outputCurrency: CHAIN_META.Ethereum_Sepolia.usdc,
    })

    if (rawAmount) query.set('exactAmount', rawAmount)
    return `https://app.uniswap.org/swap?${query.toString()}`
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <img src="/logo.webp" alt="Arc Bridge" className="logo" />
        <div className="topbar-actions">
          <span className="network-pill">{currentNetworkLabel}</span>
          <ConnectButton chainStatus="name" showBalance={false} />
          {isConnected && (
            <button className="ghost-btn" onClick={() => disconnect()}>
              Disconnect
            </button>
          )}
        </div>
      </header>

      <main className="hero-wrap">
        <section className="hero-banner">
          <img src="/banner.webp" alt="Swap and bridge banner" className="banner-image" />
          <div className="hero-copy">
            <p className="eyebrow">Native USDC bridge for testnet onboarding</p>
            <h1>Swap on Sepolia. Bridge to Arc. All in one clean screen.</h1>
            <p className="hero-text">
              Use Sepolia ETH for gas, swap into testnet USDC, then bridge native USDC between Sepolia and Arc with automatic wallet network switching.
            </p>
          </div>
        </section>

        <section className="panel-grid">
          <article className="card">
            <div className="card-head">
              <div>
                <p className="mini-label">Bridge box</p>
                <h2>USDC Bridge</h2>
              </div>
              <span className="token-badge">USDC only</span>
            </div>

            <div className="field-group">
              <label>From</label>
              <div className="select-line">
                <button className={`select-btn ${fromChain === 'Ethereum_Sepolia' ? 'active' : ''}`} onClick={() => { setFromChain('Ethereum_Sepolia'); setToChain('Arc_Testnet') }}>
                  Sepolia
                </button>
                <button className={`select-btn ${fromChain === 'Arc_Testnet' ? 'active' : ''}`} onClick={() => { setFromChain('Arc_Testnet'); setToChain('Ethereum_Sepolia') }}>
                  Arc
                </button>
              </div>
            </div>

            <button className="invert-btn" onClick={handleInvert}>⇅</button>

            <div className="field-group">
              <label>To</label>
              <div className="read-only-box">{CHAIN_META[toChain].label}</div>
            </div>

            <div className="field-group">
              <label>Amount</label>
              <div className="amount-box">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span>USDC</span>
              </div>
            </div>

            <div className="field-row">
              <div className="field-group compact">
                <label>Slippage</label>
                <div className="amount-box small">
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={slippage}
                    onChange={(e) => setSlippage(e.target.value)}
                  />
                  <span>%</span>
                </div>
              </div>
              <div className="balance-box">
                <span>Detected balance</span>
                <strong>{activeBalance} USDC</strong>
                <small>{CHAIN_META[fromChain].label}</small>
              </div>
            </div>

            <div className={`status-box ${statusTone}`}>
              <p>{status}</p>
              {bridgeTxUrl && (
                <a href={bridgeTxUrl} target="_blank" rel="noreferrer">Open source transaction</a>
              )}
            </div>

            <button className="primary-btn" onClick={handleBridge} disabled={!canBridge || busy}>
              {busy ? 'Processing...' : 'Bridge USDC'}
            </button>

            <div className="helper-row">
              <span>Wallet</span>
              <strong>{trimAddress(address)}</strong>
            </div>
            <div className="helper-row">
              <span>Gas on source</span>
              <strong>{CHAIN_META[fromChain].gasLabel}</strong>
            </div>
          </article>

          <article className="card helper-card">
            <div className="card-head">
              <div>
                <p className="mini-label">Sepolia helper</p>
                <h2>Swap ETH → USDC</h2>
              </div>
              <span className="token-badge subtle">same network</span>
            </div>

            <p className="helper-copy">
              This box is the fast path for onboarding. Most users get Sepolia ETH from a faucet first, then swap to Sepolia USDC, and only after that bridge the USDC to Arc.
            </p>

            <div className="swap-preview">
              <div>
                <span>From</span>
                <strong>ETH on Sepolia</strong>
              </div>
              <div>
                <span>To</span>
                <strong>USDC on Sepolia</strong>
              </div>
            </div>

            <a className="primary-btn link-btn" href={getSwapUrl()} target="_blank" rel="noreferrer">
              Open Sepolia swap
            </a>

            <div className="swap-links">
              <a href={CHAIN_META.Ethereum_Sepolia.faucetUrl} target="_blank" rel="noreferrer">Get Sepolia ETH</a>
              <a href="https://faucet.circle.com" target="_blank" rel="noreferrer">Get test USDC</a>
            </div>

            <div className="notes-box">
              <h3>Notes</h3>
              <ul>
                <li>Bridge Kit supports native USDC routes between Sepolia and Arc Testnet.</li>
                <li>Arc uses USDC as the native gas token, so the destination wallet also needs a little Arc-side USDC for gas.</li>
                <li>Uniswap supports Sepolia in its interface, which makes the ETH → USDC step faster for an MVP.</li>
              </ul>
            </div>
          </article>
        </section>
      </main>

      <footer className="footer">
        <span>Developed by</span>
        <a href="https://x.com/Rubensbrandao1" target="_blank" rel="noreferrer">@Rubensbrandao1</a>
      </footer>
    </div>
  )
}
