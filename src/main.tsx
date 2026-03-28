import React from 'react'
import ReactDOM from 'react-dom/client'
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { http } from 'viem'
import { sepolia } from 'viem/chains'
import App from './App'
import './styles.css'
import '@rainbow-me/rainbowkit/styles.css'

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
    public: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
} as const

const config = getDefaultConfig({
  appName: 'Arc Bridge MVP',
  projectId: 'arc-bridge-mvp-demo',
  chains: [sepolia, arcTestnet],
  transports: {
    [sepolia.id]: http(),
    [arcTestnet.id]: http('https://rpc.testnet.arc.network'),
  },
  ssr: false,
})

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
