import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Shield, Zap, Globe2, TrendingUp, Users, Award, ChevronRight, Smartphone } from 'lucide-react'

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.nalmifx.app'

// IntersectionObserver-based reveal hook
const useReveal = (options = {}) => {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.15, ...options }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, visible]
}

// Animated number counter
const Counter = ({ end, duration = 2000, suffix = '', prefix = '' }) => {
  const [val, setVal] = useState(0)
  const [ref, visible] = useReveal()

  useEffect(() => {
    if (!visible) return
    const start = performance.now()
    let raf
    const tick = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(Math.floor(end * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible, end, duration])

  return (
    <span ref={ref}>
      {prefix}{val.toLocaleString()}{suffix}
    </span>
  )
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
          <a href="/cryptocurrencies" className="hidden sm:inline text-white hover:text-[#CFF12F] transition-colors text-[15px] font-medium">Cryptocurrencies</a>
          <a href="/support" className="hidden sm:inline text-white hover:text-[#CFF12F] transition-colors text-[15px] font-medium">Support</a>
          <button onClick={() => navigate('/user/login')} className="text-white hover:text-[#CFF12F] transition-colors text-[15px] font-medium hidden sm:block">Log in</button>
          <button onClick={() => navigate('/user/signup')} className="bg-[#CFF12F] text-black px-[18px] py-[9px] rounded-[24px] text-[15px] font-bold hover:brightness-110 transition-all whitespace-nowrap">Sign up</button>
        </div>
      </div>
    </nav>
  )
}

// Hero
const Hero = () => {
  return (
    <section className="relative w-full h-screen min-h-[640px] overflow-hidden bg-[#110E08]">
      <div className="absolute inset-0 z-0">
        <video
          autoPlay muted loop playsInline
          className="w-full h-full object-cover"
          poster="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/a30101db-b978-4ecc-8998-3de500870677-robinhood-com/assets/images/Texture_1_Desktop-5.jpg"
        >
          <source src="https://videos.ctfassets.net/ilblxxee70tt/5RCR93puejnArBBUkpGUSb/49b64b6ca96cbb32b97d5a095b95393b/Texture_1_Desktop.webm" type="video/webm" />
        </video>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, rgba(17,14,8,0.3) 0%, rgba(17,14,8,0.85) 100%)' }} />
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full px-6 text-center">
        <div className="max-w-[1000px] flex flex-col items-center">
          <span className="inline-block text-[#CFF12F] text-[14px] font-medium mb-6 tracking-[0.2em] uppercase animate-fade-in-up">About NalmiFX</span>
          <h1
            className="text-white mb-6 animate-fade-in-up"
            style={{ fontSize: 'clamp(3rem, 7vw, 5rem)', lineHeight: '1.1', fontWeight: 300, letterSpacing: '-0.02em', animationDelay: '120ms' }}
          >
            Building the future of <span className="text-[#CFF12F]">global trading</span>
          </h1>
          <p className="text-white/85 text-lg md:text-xl max-w-[680px] mb-10 leading-[1.6] animate-fade-in-up" style={{ animationDelay: '240ms' }}>
            We're on a mission to give everyone access to world-class markets — forex, crypto, and beyond — with the tools, transparency, and speed that professionals demand.
          </p>
          <a href="#mission" className="inline-flex items-center gap-2 bg-[#CFF12F] text-black px-7 py-3 rounded-full text-base font-medium hover:brightness-110 active:scale-[0.98] transition-all animate-fade-in-up" style={{ animationDelay: '360ms' }}>
            Our Story <ArrowRight size={18} />
          </a>
        </div>
      </div>
    </section>
  )
}

// Mission
const Mission = () => {
  const [ref, visible] = useReveal()
  return (
    <section id="mission" ref={ref} className="bg-[#CFF12F] text-black overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 md:px-[60px] py-20 md:py-[140px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-[100px] items-center">
          <div className={`transition-all duration-700 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
            <h3 className="text-[16px] font-medium tracking-[0.2em] uppercase opacity-70 mb-6">Our Mission</h3>
            <h2 className="text-[42px] md:text-[64px] font-light leading-[1.05] mb-8 tracking-[-0.02em]">
              Markets without<br />borders
            </h2>
            <p className="text-[18px] leading-[1.6] text-black/85 mb-6">
              For too long, global markets have been gated by geography, paperwork, and minimums that put serious trading out of reach. NalmiFX flips that. One account, one app, every market — from major forex pairs to the next generation of digital assets.
            </p>
            <p className="text-[18px] leading-[1.6] text-black/85">
              We believe a trader in Mumbai, Manila, or Madrid deserves the same execution quality as a desk in London or New York. That belief shapes every product decision we make.
            </p>
          </div>
          <div className={`relative transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            <div className="aspect-square bg-black rounded-[24px] overflow-hidden relative">
              <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-80">
                <source src="https://videos.ctfassets.net/ilblxxee70tt/2s4toSMKFMvqnwyBZyS6LD/16627808bbf120f5a1264d23b1007278/EU_Web_Landing_Hero_Desktop_Short.webm" type="video/webm" />
              </video>
              <div className="absolute inset-0 flex items-end p-8">
                <div>
                  <div className="text-white text-[28px] font-light leading-tight">From a small team to a global trading destination.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Stats
// const Stats = () => {
//   const items = [
//     { end: 26, suffix: 'M+', label: 'Active traders' },
//     { end: 65, suffix: '+', label: 'Crypto assets' },
//     { end: 2000, suffix: '+', label: 'Stock tokens' },
//     { end: 99, suffix: '.9%', label: 'Uptime SLA' },
//   ]
//   const [ref, visible] = useReveal()
//   return (
//     <section ref={ref} className="bg-[#110E08] text-white py-20 md:py-[120px] border-y border-[#2A2620]">
//       <div className="max-w-[1440px] mx-auto px-6 md:px-[60px]">
//         <div className="text-center mb-16">
//           <h3 className="text-[#CFF12F] text-[14px] font-medium tracking-[0.2em] uppercase mb-4">By the numbers</h3>
//           <h2 className="text-[40px] md:text-[56px] font-light leading-[1.1] tracking-[-0.02em]">Trusted at scale</h2>
//         </div>
//         <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
//           {items.map((item, i) => (
//             <div
//               key={item.label}
//               className={`text-center transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
//               style={{ transitionDelay: `${i * 120}ms` }}
//             >
//               <div className="text-[#CFF12F] text-[48px] md:text-[72px] font-light leading-none mb-3 tracking-[-0.02em]">
//                 {visible && <Counter end={item.end} suffix={item.suffix} />}
//               </div>
//               <div className="text-white/70 text-[14px] md:text-[16px] uppercase tracking-wider">{item.label}</div>
//             </div>
//           ))}
//         </div>
//       </div>
//     </section>
//   )
// }

// Values
const Values = () => {
  const values = [
    { Icon: Shield, title: 'Security first', desc: 'Cold-storage custody, segregated client funds, and 24/7 monitoring keep your capital safe.' },
    { Icon: Zap, title: 'Built for speed', desc: 'Sub-millisecond execution on a deep-liquidity matching engine designed for serious volume.' },
    { Icon: Globe2, title: 'Global by design', desc: 'Localized payment rails, multi-language support, and 24/7 markets — wherever you trade from.' },
    { Icon: TrendingUp, title: 'Pro-grade tools', desc: 'Charting, automation, copy trading, and prop challenges — institutional features for everyone.' },
    { Icon: Users, title: 'Community driven', desc: 'A growing network of traders, IBs, and partners shaping the platform alongside us.' },
    { Icon: Award, title: 'Earned trust', desc: 'Compliant operations, transparent fees, and responsive support — every single day.' },
  ]
  const [ref, visible] = useReveal()
  return (
    <section ref={ref} className="bg-black text-white py-20 md:py-[140px]">
      <div className="max-w-[1440px] mx-auto px-6 md:px-[60px]">
        <div className="max-w-[640px] mb-16">
          <h3 className="text-[#CFF12F] text-[14px] font-medium tracking-[0.2em] uppercase mb-4">What we stand for</h3>
          <h2 className="text-[40px] md:text-[64px] font-light leading-[1.05] tracking-[-0.02em]">Six principles, one platform</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {values.map(({ Icon, title, desc }, i) => (
            <div
              key={title}
              className={`group p-8 rounded-[20px] bg-[#1a1610] border border-[#2A2620] hover:border-[#CFF12F]/40 hover:bg-[#221d15] transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-[#CFF12F]/10 flex items-center justify-center mb-6 group-hover:bg-[#CFF12F]/20 group-hover:scale-110 transition-all">
                <Icon size={22} className="text-[#CFF12F]" />
              </div>
              <h4 className="text-[20px] font-medium mb-3">{title}</h4>
              <p className="text-white/70 text-[15px] leading-[1.6]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Timeline / Journey
// const Timeline = () => {
//   const milestones = [
//     { year: '2023', title: 'NalmiFX founded', desc: 'A small team set out to rebuild retail trading from the ground up.' },
//     { year: '2024', title: 'Multi-asset launch', desc: 'Forex, crypto, and stock tokens went live on a single unified platform.' },
//     { year: '2025', title: 'Global expansion', desc: 'Localized payments, IB program, and prop challenges rolled out worldwide.' },
//     { year: '2026', title: 'The next chapter', desc: 'Mobile-first trading and copy trading reach millions of new users.' },
//   ]
//   const [ref, visible] = useReveal()
//   return (
//     <section ref={ref} className="bg-[#110E08] text-white py-20 md:py-[140px]">
//       <div className="max-w-[1100px] mx-auto px-6 md:px-[60px]">
//         <div className="text-center mb-16">
//           <h3 className="text-[#CFF12F] text-[14px] font-medium tracking-[0.2em] uppercase mb-4">Our journey</h3>
//           <h2 className="text-[40px] md:text-[56px] font-light leading-[1.05] tracking-[-0.02em]">Where we've been</h2>
//         </div>
//         <div className="relative">
//           <div className="absolute left-[20px] md:left-1/2 top-0 bottom-0 w-px bg-[#2A2620] md:-translate-x-1/2" />
//           <div className="space-y-12 md:space-y-20">
//             {milestones.map((m, i) => (
//               <div
//                 key={m.year}
//                 className={`relative flex items-start md:items-center gap-6 md:gap-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}
//                 style={{ transitionDelay: `${i * 150}ms` }}
//               >
//                 <div className="absolute left-[12px] md:left-1/2 w-[18px] h-[18px] rounded-full bg-[#CFF12F] ring-4 ring-[#110E08] md:-translate-x-1/2 z-10" />
//                 <div className="ml-12 md:ml-0 md:w-1/2 md:px-8">
//                   <div className="text-[#CFF12F] text-[14px] font-medium tracking-[0.2em] uppercase mb-2">{m.year}</div>
//                   <h4 className="text-[24px] md:text-[28px] font-light mb-2">{m.title}</h4>
//                   <p className="text-white/70 text-[16px] leading-[1.6]">{m.desc}</p>
//                 </div>
//                 <div className="hidden md:block md:w-1/2" />
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>
//     </section>
//   )
// }

// CTA
const CTA = () => {
  const navigate = useNavigate()
  const [ref, visible] = useReveal()
  return (
    <section ref={ref} className="relative w-full overflow-hidden bg-black">
      <div className="absolute inset-0 z-0">
        <img
          src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/a30101db-b978-4ecc-8998-3de500870677-robinhood-com/assets/images/landing-crypto-desktop-3.jpeg"
          alt=""
          className="w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.85) 100%)' }} />
      </div>
      <div className="relative z-10 max-w-[1100px] mx-auto px-6 md:px-[60px] py-24 md:py-[160px] text-center">
        <h2 className={`text-white text-[44px] md:text-[72px] font-light leading-[1.05] tracking-[-0.02em] mb-8 max-w-[900px] mx-auto transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          Ready to trade with the best?
        </h2>
        <p className={`text-white/80 text-[18px] md:text-[20px] leading-[1.6] mb-10 max-w-[640px] mx-auto transition-all duration-700 delay-150 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          Open an account in minutes. No paperwork, no minimums, no nonsense.
        </p>
        <div className={`flex flex-wrap justify-center gap-4 transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <button onClick={() => navigate('/user/signup')} className="inline-flex items-center gap-2 bg-[#CFF12F] text-black px-8 py-[14px] rounded-full text-[16px] font-semibold hover:brightness-110 active:scale-[0.98] transition-all">
            Get started <ArrowRight size={18} />
          </button>
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 text-white px-8 py-[14px] rounded-full text-[16px] font-semibold hover:bg-white/15 transition-all">
            <Smartphone size={18} /> Get the app
          </a>
        </div>
      </div>
    </section>
  )
}

// Mini Footer
const MiniFooter = () => {
  return (
    <footer className="bg-[#110E08] text-white/60 border-t border-[#2A2620] py-10 px-6 md:px-[60px]">
      <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-[13px]">
        <div className="flex items-center gap-2">
          <span>© 2025 NalmiFX. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="/privacy" className="hover:text-[#CFF12F] transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-[#CFF12F] transition-colors">Terms</a>
          <a href="/support" className="hover:text-[#CFF12F] transition-colors">Support</a>
          <a href="/" className="hover:text-[#CFF12F] transition-colors inline-flex items-center gap-1">Home <ChevronRight size={14} /></a>
        </div>
      </div>
    </footer>
  )
}

const AboutUs = () => {
  return (
    <div className="flex flex-col min-h-screen bg-[#110E08]">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          opacity: 0;
          animation: fadeInUp 0.9s ease-out forwards;
        }
      `}</style>
      <Nav />
      <main>
        <Hero />
        <Mission />
        <Values />
        <CTA />
      </main>
      <MiniFooter />
    </div>
  )
}

export default AboutUs
