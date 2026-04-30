import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, TrendingUp, TrendingDown, RefreshCw, Shield, Zap, Wallet, ChevronRight, Smartphone } from 'lucide-react'

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.nalmifx.app'

// Coins to display - id is CoinGecko id
const COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', color: '#F7931A', desc: 'The original cryptocurrency. A peer-to-peer digital cash system secured by proof-of-work and a fixed 21M supply.' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', color: '#627EEA', desc: 'The leading smart-contract platform. Powers DeFi, NFTs, and most of the on-chain economy.' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', color: '#14F195', desc: 'A high-throughput layer-1 known for fast finality and low fees, popular for trading and consumer apps.' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', color: '#F3BA2F', desc: 'Native token of the BNB Chain ecosystem, used across one of the largest crypto trading networks.' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', color: '#00AAE4', desc: 'Designed for fast, low-cost cross-border value transfer between financial institutions.' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', color: '#0033AD', desc: 'A research-driven proof-of-stake blockchain with a focus on formal verification and scalability.' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', color: '#C2A633', desc: 'The original meme coin turned cultural phenomenon, now widely used for tipping and payments.' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', color: '#E6007A', desc: 'A multi-chain network connecting specialized blockchains into a single interoperable ecosystem.' },
]

const COINGECKO_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${COINS.map(c => c.id).join(',')}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`

const useReveal = (options = {}) => {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.15, ...options })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, visible]
}

const formatPrice = (n) => {
  if (n == null) return '—'
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n >= 0.01) return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  return n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })
}

const formatMarketCap = (n) => {
  if (n == null) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

// Sticky Nav
const Nav = () => {
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <nav className={`fixed top-0 left-0 right-0 z-[100] transition-colors duration-300 h-[64px] flex items-center ${scrolled ? 'bg-[#110E08] border-b border-[#2A2620]' : 'bg-transparent'}`}>
      <div className="max-w-[1440px] mx-auto px-[24px] lg:px-[60px] flex items-center justify-between w-full">
        <a href="/" className="flex items-center">
          <img src="/nalmifx.png" alt="NalmiFX" className="h-[50px] w-auto object-contain" />
        </a>
        <div className="flex items-center gap-3 md:gap-5">
          <a href="/about-us" className="hidden sm:inline text-white hover:text-[#CFF12F] transition-colors text-[15px] font-medium">About</a>
          <a href="/support" className="hidden sm:inline text-white hover:text-[#CFF12F] transition-colors text-[15px] font-medium">Support</a>
          <button onClick={() => navigate('/user/login')} className="text-white hover:text-[#CFF12F] transition-colors text-[15px] font-medium hidden sm:block">Log in</button>
          <button onClick={() => navigate('/user/signup')} className="bg-[#CFF12F] text-black px-[18px] py-[9px] rounded-[24px] text-[15px] font-bold hover:brightness-110 transition-all whitespace-nowrap">Sign up</button>
        </div>
      </div>
    </nav>
  )
}

// Hero
const Hero = ({ totalMarketCap }) => {
  return (
    <section className="relative w-full pt-[120px] pb-[80px] md:pt-[180px] md:pb-[120px] overflow-hidden bg-[#110E08]">
      <div className="absolute inset-0 z-0 opacity-40">
        <img
          src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/a30101db-b978-4ecc-8998-3de500870677-robinhood-com/assets/images/landing-crypto-desktop-3.jpeg"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(17,14,8,0.6) 0%, rgba(17,14,8,1) 100%)' }} />
      </div>
      <div className="relative z-10 max-w-[1100px] mx-auto px-6 md:px-[60px] text-center">
        <span className="inline-block text-[#CFF12F] text-[14px] font-medium mb-6 tracking-[0.2em] uppercase animate-fade-in-up">Cryptocurrencies</span>
        <h1
          className="text-white mb-6 animate-fade-in-up"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', lineHeight: '1.1', fontWeight: 300, letterSpacing: '-0.02em', animationDelay: '120ms' }}
        >
          Trade the world's leading <span className="text-[#CFF12F]">digital assets</span>
        </h1>
        <p className="text-white/85 text-[17px] md:text-[20px] max-w-[720px] mx-auto leading-[1.6] mb-8 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
          Bitcoin, Ethereum, and 60+ other cryptocurrencies — buy, sell, and stake them all on a single platform built for speed and security.
        </p>
        {totalMarketCap > 0 && (
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-white/80 text-[13px] animate-fade-in-up" style={{ animationDelay: '360ms' }}>
            <span className="w-2 h-2 rounded-full bg-[#CFF12F] animate-pulse" />
            Live total market cap of tracked coins: <span className="text-white font-semibold">{formatMarketCap(totalMarketCap)}</span>
          </div>
        )}
      </div>
    </section>
  )
}

// What is Crypto explainer
const Explainer = () => {
  const items = [
    { Icon: Shield, title: 'Decentralized', desc: 'Cryptocurrencies run on distributed networks, not controlled by any single bank or government.' },
    { Icon: Zap, title: '24/7 markets', desc: 'Unlike stock markets, crypto trades 24 hours a day, every day of the year — globally.' },
    { Icon: Wallet, title: 'You own it', desc: 'When you hold crypto in a self-custodied wallet, only you control the keys to your funds.' },
  ]
  const [ref, visible] = useReveal()
  return (
    <section ref={ref} className="bg-[#110E08] text-white py-16 md:py-[100px] border-t border-[#2A2620]">
      <div className="max-w-[1440px] mx-auto px-6 md:px-[60px]">
        <div className="max-w-[640px] mb-12">
          <h3 className="text-[#CFF12F] text-[14px] font-medium tracking-[0.2em] uppercase mb-4">What is crypto?</h3>
          <h2 className="text-[36px] md:text-[52px] font-light leading-[1.05] tracking-[-0.02em]">Internet-native money</h2>
          <p className="text-white/70 text-[16px] md:text-[18px] leading-[1.6] mt-6">
            Cryptocurrencies are digital assets secured by cryptography and recorded on public blockchains. They let anyone, anywhere, send value over the internet — without intermediaries.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map(({ Icon, title, desc }, i) => (
            <div
              key={title}
              className={`p-6 md:p-8 rounded-[20px] bg-[#1a1610] border border-[#2A2620] hover:border-[#CFF12F]/40 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <div className="w-11 h-11 rounded-xl bg-[#CFF12F]/10 flex items-center justify-center mb-5">
                <Icon size={20} className="text-[#CFF12F]" />
              </div>
              <h4 className="text-[20px] font-medium mb-2">{title}</h4>
              <p className="text-white/70 text-[15px] leading-[1.6]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Live Rates Table
const LiveRates = ({ data, loading, error, lastUpdated, onRefresh }) => {
  return (
    <section className="bg-black text-white py-16 md:py-[100px]">
      <div className="max-w-[1440px] mx-auto px-6 md:px-[60px]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h3 className="text-[#CFF12F] text-[14px] font-medium tracking-[0.2em] uppercase mb-3">Live rates</h3>
            <h2 className="text-[36px] md:text-[52px] font-light leading-[1.05] tracking-[-0.02em]">Today's prices</h2>
          </div>
          <div className="flex items-center gap-3 text-[13px] text-white/60">
            {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[14px]">
            Couldn't load live prices: {error}. Showing cached data if available.
          </div>
        )}

        <div className="rounded-[20px] border border-[#2A2620] overflow-hidden bg-[#1a1610]">
          <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 text-[12px] uppercase tracking-wider text-white/50 border-b border-[#2A2620]">
            <div>Asset</div>
            <div className="text-right">Price (USD)</div>
            <div className="text-right">24h Change</div>
            <div className="text-right">Market Cap</div>
            <div className="w-[100px] text-right">Action</div>
          </div>
          {COINS.map((coin) => {
            const row = data?.[coin.id]
            const price = row?.usd
            const change = row?.usd_24h_change
            const cap = row?.usd_market_cap
            const positive = (change ?? 0) >= 0
            return (
              <div
                key={coin.id}
                className="grid grid-cols-[1fr_auto] md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 px-4 md:px-6 py-4 border-b border-[#2A2620] last:border-b-0 items-center hover:bg-[#221d15] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[12px] font-bold"
                    style={{ backgroundColor: coin.color }}
                  >
                    {coin.symbol.slice(0, 3)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{coin.name}</div>
                    <div className="text-white/50 text-[13px]">{coin.symbol}</div>
                  </div>
                </div>
                <div className="md:text-right text-right">
                  <div className="font-semibold tabular-nums">${formatPrice(price)}</div>
                  <div className="md:hidden mt-1">
                    {change != null && (
                      <span className={`inline-flex items-center gap-1 text-[13px] font-medium tabular-nums ${positive ? 'text-[#CFF12F]' : 'text-red-400'}`}>
                        {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {positive ? '+' : ''}{change.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="hidden md:block text-right">
                  {change != null ? (
                    <span className={`inline-flex items-center gap-1 font-medium tabular-nums ${positive ? 'text-[#CFF12F]' : 'text-red-400'}`}>
                      {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {positive ? '+' : ''}{change.toFixed(2)}%
                    </span>
                  ) : '—'}
                </div>
                <div className="hidden md:block text-right text-white/80 tabular-nums">{formatMarketCap(cap)}</div>
                <div className="hidden md:block w-[100px] text-right">
                  <a href="/user/signup" className="inline-block bg-[#CFF12F] text-black text-[13px] font-semibold px-4 py-2 rounded-full hover:brightness-110 transition-all">Trade</a>
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-[12px] text-white/50 mt-4">
          Prices are sourced from public market data and refreshed periodically. Trading view inside the app reflects exchange-quoted execution prices.
        </p>
      </div>
    </section>
  )
}

// Featured cards (educational)
const Featured = () => {
  const [ref, visible] = useReveal()
  return (
    <section ref={ref} className="bg-[#110E08] text-white py-16 md:py-[100px] border-t border-[#2A2620]">
      <div className="max-w-[1440px] mx-auto px-6 md:px-[60px]">
        <div className="max-w-[640px] mb-10">
          <h3 className="text-[#CFF12F] text-[14px] font-medium tracking-[0.2em] uppercase mb-4">Get to know the assets</h3>
          <h2 className="text-[36px] md:text-[52px] font-light leading-[1.05] tracking-[-0.02em]">Featured cryptocurrencies</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {COINS.slice(0, 8).map((coin, i) => (
            <div
              key={coin.id}
              className={`p-6 rounded-[18px] bg-[#1a1610] border border-[#2A2620] hover:border-[#CFF12F]/40 hover:-translate-y-1 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[12px] font-bold"
                  style={{ backgroundColor: coin.color }}
                >
                  {coin.symbol.slice(0, 3)}
                </div>
                <div>
                  <div className="font-semibold">{coin.name}</div>
                  <div className="text-white/50 text-[12px]">{coin.symbol}</div>
                </div>
              </div>
              <p className="text-white/70 text-[14px] leading-[1.6]">{coin.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// CTA
const CTA = () => {
  const navigate = useNavigate()
  const [ref, visible] = useReveal()
  return (
    <section ref={ref} className="bg-[#CFF12F] text-black py-20 md:py-[140px] overflow-hidden">
      <div className="max-w-[1100px] mx-auto px-6 md:px-[60px] text-center">
        <h2 className={`text-[40px] md:text-[64px] font-light leading-[1.05] tracking-[-0.02em] mb-6 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          Start trading crypto in minutes
        </h2>
        <p className={`text-[18px] md:text-[20px] leading-[1.6] mb-10 max-w-[640px] mx-auto text-black/85 transition-all duration-700 delay-150 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          Open an account, deposit, and place your first trade — all from the same app.
        </p>
        <div className={`flex flex-wrap justify-center gap-4 transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <button onClick={() => navigate('/user/signup')} className="inline-flex items-center gap-2 bg-black text-white px-8 py-[14px] rounded-full text-[16px] font-semibold hover:brightness-110 active:scale-[0.98] transition-all">
            Get started <ArrowRight size={18} />
          </button>
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-black/10 border border-black/20 text-black px-8 py-[14px] rounded-full text-[16px] font-semibold hover:bg-black/15 transition-all">
            <Smartphone size={18} /> Get the app
          </a>
        </div>
        <p className="text-[12px] text-black/60 mt-10 max-w-[720px] mx-auto leading-[1.6]">
          Cryptocurrency trading is highly volatile and may not be suitable for all investors. The value of digital assets can rise or fall sharply. Trade only what you can afford to lose.
        </p>
      </div>
    </section>
  )
}

// Mini Footer
const MiniFooter = () => {
  return (
    <footer className="bg-[#110E08] text-white/60 border-t border-[#2A2620] py-10 px-6 md:px-[60px]">
      <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-[13px]">
        <span>© 2025 NalmiFX. All rights reserved.</span>
        <div className="flex items-center gap-6">
          <a href="/privacy" className="hover:text-[#CFF12F] transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-[#CFF12F] transition-colors">Terms</a>
          <a href="/about-us" className="hover:text-[#CFF12F] transition-colors">About</a>
          <a href="/" className="hover:text-[#CFF12F] transition-colors inline-flex items-center gap-1">Home <ChevronRight size={14} /></a>
        </div>
      </div>
    </footer>
  )
}

const Cryptocurrencies = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchPrices = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(COINGECKO_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrices()
    const id = setInterval(fetchPrices, 60_000)
    return () => clearInterval(id)
  }, [])

  const totalMarketCap = data
    ? Object.values(data).reduce((sum, c) => sum + (c?.usd_market_cap || 0), 0)
    : 0

  return (
    <div className="flex flex-col min-h-screen bg-[#110E08]">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { opacity: 0; animation: fadeInUp 0.9s ease-out forwards; }
      `}</style>
      <Nav />
      <main>
        <Hero totalMarketCap={totalMarketCap} />
        <Explainer />
        <LiveRates data={data} loading={loading} error={error} lastUpdated={lastUpdated} onRefresh={fetchPrices} />
        <Featured />
        <CTA />
      </main>
      <MiniFooter />
    </div>
  )
}

export default Cryptocurrencies
