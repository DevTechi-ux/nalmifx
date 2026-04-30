import React, { useState, useEffect, useRef, createContext, useContext } from 'react'
import { ChevronDown, Globe, Smartphone, TrendingUp, Bitcoin, Users, Briefcase, Award } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// App Download Links
const APP_DOWNLOAD_URL = 'https://api.nalmifx.com/downloads/nalmifx.apk'
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.nalmifx.app'

// Available languages
const LANGUAGES = [
  { code: 'EN', label: 'English' },
  { code: 'ES', label: 'Español' },
  { code: 'FR', label: 'Français' },
  { code: 'DE', label: 'Deutsch' },
  { code: 'ZH', label: '中文' },
  { code: 'AR', label: 'العربية' },
  { code: 'HI', label: 'हिन्दी' },
]

// Translation dictionary
const TRANSLATIONS = {
  EN: {
    whatWeOffer: 'What We Offer', support: 'Support', downloadApp: 'Download App',
    app: 'App', logIn: 'Log in', signUp: 'Sign up',
    heroTitle: 'One place for all your investments',
    heroSubtitle: 'Everything you need to start investing is here. From Stock Tokens to crypto—buy, sell, and manage it all in one place.',
    getStarted: 'Get started', learnMore: 'Learn more',
    investHeading: 'Get started with Stock Tokens',
    investDesc: 'Explore 2,000+ Stock Tokens linked to NVIDIA, Microsoft, Apple, Vanguard S&P 500 ETF, and more.',
    invest: 'Invest', cryptoHeading: 'Get more crypto for your money',
    cryptoDesc: 'Trade popular crypto like BTC, ETH, and SOL at one of the lowest costs on average. Explore 65+ crypto—all at low costs.',
    perpetualHeading: 'Crypto perpetual futures with leverage',
    perpetualDesc: 'Advanced traders can trade with leverage, open long or short positions and more—in a few taps.',
    securityTitle: 'Industry-leading security. Trusted by over 26 million users.',
    getTheApp: 'Get the App', followUs: 'Follow us on', downloadOn: 'Download on',
    android: 'Android (APK)', googlePlay: 'Google Play',
    forexTrading: 'Forex Trading', cryptoTrading: 'Crypto Trading',
    copyTrading: 'Copy Trading', propTrading: 'Prop Trading', ibProgram: 'IB Program',
    forexDesc: 'Trade major and minor currency pairs',
    cryptoTradeDesc: 'Buy, sell, and stake digital assets',
    copyDesc: 'Mirror top traders automatically',
    propDesc: 'Get funded and trade our capital',
    ibDesc: 'Earn commissions as an introducing broker',
  },
  ES: {
    whatWeOffer: 'Lo que ofrecemos', support: 'Soporte', downloadApp: 'Descargar App',
    app: 'App', logIn: 'Iniciar sesión', signUp: 'Registrarse',
    heroTitle: 'Un solo lugar para todas tus inversiones',
    heroSubtitle: 'Todo lo que necesitas para empezar a invertir está aquí. Desde Stock Tokens hasta cripto—compra, vende y gestiona todo en un solo lugar.',
    getStarted: 'Comenzar', learnMore: 'Más información',
    investHeading: 'Empieza con Stock Tokens',
    investDesc: 'Explora más de 2,000 Stock Tokens vinculados a NVIDIA, Microsoft, Apple, Vanguard S&P 500 ETF y más.',
    invest: 'Invertir', cryptoHeading: 'Obtén más cripto por tu dinero',
    cryptoDesc: 'Opera cripto populares como BTC, ETH y SOL a uno de los costos más bajos en promedio. Explora más de 65 cripto—a bajo costo.',
    perpetualHeading: 'Futuros perpetuos cripto con apalancamiento',
    perpetualDesc: 'Los traders avanzados pueden operar con apalancamiento, abrir posiciones largas o cortas y más—en pocos toques.',
    securityTitle: 'Seguridad líder en la industria. Confiado por más de 26 millones de usuarios.',
    getTheApp: 'Descarga la App', followUs: 'Síguenos', downloadOn: 'Descargar en',
    android: 'Android (APK)', googlePlay: 'Google Play',
    forexTrading: 'Trading de Forex', cryptoTrading: 'Trading de Cripto',
    copyTrading: 'Copy Trading', propTrading: 'Prop Trading', ibProgram: 'Programa IB',
    forexDesc: 'Opera pares de divisas mayores y menores',
    cryptoTradeDesc: 'Compra, vende y haz staking de activos digitales',
    copyDesc: 'Replica automáticamente a los mejores traders',
    propDesc: 'Recibe financiación y opera nuestro capital',
    ibDesc: 'Gana comisiones como bróker introductor',
  },
  FR: {
    whatWeOffer: 'Ce que nous offrons', support: 'Support', downloadApp: "Télécharger l'App",
    app: 'App', logIn: 'Connexion', signUp: "S'inscrire",
    heroTitle: 'Un seul endroit pour tous vos investissements',
    heroSubtitle: 'Tout ce dont vous avez besoin pour commencer à investir est ici. Des Stock Tokens aux cryptos—achetez, vendez et gérez tout en un seul endroit.',
    getStarted: 'Commencer', learnMore: 'En savoir plus',
    investHeading: 'Commencez avec les Stock Tokens',
    investDesc: 'Explorez plus de 2 000 Stock Tokens liés à NVIDIA, Microsoft, Apple, Vanguard S&P 500 ETF et plus.',
    invest: 'Investir', cryptoHeading: "Plus de crypto pour votre argent",
    cryptoDesc: "Tradez les cryptos populaires comme BTC, ETH et SOL à l'un des coûts les plus bas en moyenne. Explorez plus de 65 cryptos—à bas coût.",
    perpetualHeading: 'Futures perpétuels crypto avec effet de levier',
    perpetualDesc: 'Les traders avancés peuvent trader avec un effet de levier, ouvrir des positions longues ou courtes et plus—en quelques clics.',
    securityTitle: "Sécurité de pointe. Approuvée par plus de 26 millions d'utilisateurs.",
    getTheApp: "Obtenir l'App", followUs: 'Suivez-nous', downloadOn: 'Télécharger sur',
    android: 'Android (APK)', googlePlay: 'Google Play',
    forexTrading: 'Trading Forex', cryptoTrading: 'Trading Crypto',
    copyTrading: 'Copy Trading', propTrading: 'Prop Trading', ibProgram: 'Programme IB',
    forexDesc: 'Tradez des paires de devises majeures et mineures',
    cryptoTradeDesc: 'Achetez, vendez et stakez des actifs numériques',
    copyDesc: 'Copiez automatiquement les meilleurs traders',
    propDesc: 'Soyez financé et tradez notre capital',
    ibDesc: 'Gagnez des commissions en tant que courtier introducteur',
  },
  DE: {
    whatWeOffer: 'Was wir bieten', support: 'Support', downloadApp: 'App herunterladen',
    app: 'App', logIn: 'Anmelden', signUp: 'Registrieren',
    heroTitle: 'Ein Ort für alle Ihre Investitionen',
    heroSubtitle: 'Alles, was Sie brauchen, um mit Investieren zu beginnen. Von Stock Tokens bis Krypto—kaufen, verkaufen und verwalten Sie alles an einem Ort.',
    getStarted: 'Loslegen', learnMore: 'Mehr erfahren',
    investHeading: 'Starten Sie mit Stock Tokens',
    investDesc: 'Entdecken Sie 2.000+ Stock Tokens mit Bezug zu NVIDIA, Microsoft, Apple, Vanguard S&P 500 ETF und mehr.',
    invest: 'Investieren', cryptoHeading: 'Mehr Krypto für Ihr Geld',
    cryptoDesc: 'Handeln Sie beliebte Kryptos wie BTC, ETH und SOL zu einem der niedrigsten Kosten im Durchschnitt. Entdecken Sie 65+ Kryptos—zu niedrigen Kosten.',
    perpetualHeading: 'Krypto Perpetual Futures mit Hebel',
    perpetualDesc: 'Fortgeschrittene Trader können mit Hebel handeln, Long- oder Short-Positionen eröffnen und mehr—mit wenigen Klicks.',
    securityTitle: 'Branchenführende Sicherheit. Vertrauen von über 26 Millionen Nutzern.',
    getTheApp: 'App holen', followUs: 'Folgen Sie uns', downloadOn: 'Herunterladen auf',
    android: 'Android (APK)', googlePlay: 'Google Play',
    forexTrading: 'Forex-Handel', cryptoTrading: 'Krypto-Handel',
    copyTrading: 'Copy Trading', propTrading: 'Prop Trading', ibProgram: 'IB-Programm',
    forexDesc: 'Handeln Sie wichtige und kleinere Währungspaare',
    cryptoTradeDesc: 'Kaufen, verkaufen und staken Sie digitale Vermögenswerte',
    copyDesc: 'Spiegeln Sie automatisch Top-Trader',
    propDesc: 'Erhalten Sie Finanzierung und handeln Sie unser Kapital',
    ibDesc: 'Verdienen Sie Provisionen als einführender Broker',
  },
  ZH: {
    whatWeOffer: '我们的服务', support: '支持', downloadApp: '下载应用',
    app: '应用', logIn: '登录', signUp: '注册',
    heroTitle: '所有投资的一站式平台',
    heroSubtitle: '开始投资所需的一切都在这里。从股票代币到加密货币—在一个地方买卖和管理。',
    getStarted: '开始', learnMore: '了解更多',
    investHeading: '从股票代币开始',
    investDesc: '探索 2,000+ 与 NVIDIA、微软、苹果、Vanguard S&P 500 ETF 等关联的股票代币。',
    invest: '投资', cryptoHeading: '用您的钱获得更多加密货币',
    cryptoDesc: '以平均最低成本之一交易 BTC、ETH 和 SOL 等流行加密货币。探索 65+ 加密货币—低成本。',
    perpetualHeading: '杠杆加密永续合约',
    perpetualDesc: '高级交易者可以使用杠杆进行交易，开多或开空头寸—只需几次点击。',
    securityTitle: '行业领先的安全性。超过 2600 万用户信赖。',
    getTheApp: '获取应用', followUs: '关注我们', downloadOn: '下载于',
    android: '安卓 (APK)', googlePlay: 'Google Play',
    forexTrading: '外汇交易', cryptoTrading: '加密货币交易',
    copyTrading: '跟单交易', propTrading: '自营交易', ibProgram: 'IB 计划',
    forexDesc: '交易主要和次要货币对',
    cryptoTradeDesc: '买卖和质押数字资产',
    copyDesc: '自动复制顶级交易者',
    propDesc: '获得资金并交易我们的资本',
    ibDesc: '作为介绍经纪人赚取佣金',
  },
  AR: {
    whatWeOffer: 'ما نقدمه', support: 'الدعم', downloadApp: 'تحميل التطبيق',
    app: 'تطبيق', logIn: 'تسجيل الدخول', signUp: 'إنشاء حساب',
    heroTitle: 'مكان واحد لجميع استثماراتك',
    heroSubtitle: 'كل ما تحتاجه لبدء الاستثمار هنا. من رموز الأسهم إلى العملات الرقمية—اشترِ وبع وأدر كل شيء في مكان واحد.',
    getStarted: 'ابدأ', learnMore: 'اعرف المزيد',
    investHeading: 'ابدأ مع رموز الأسهم',
    investDesc: 'استكشف أكثر من 2000 رمز سهم مرتبط بـ NVIDIA و Microsoft و Apple و Vanguard S&P 500 ETF والمزيد.',
    invest: 'استثمر', cryptoHeading: 'احصل على المزيد من العملات الرقمية مقابل أموالك',
    cryptoDesc: 'تداول العملات الرقمية الشهيرة مثل BTC و ETH و SOL بأحد أدنى التكاليف في المتوسط. استكشف أكثر من 65 عملة رقمية—بتكاليف منخفضة.',
    perpetualHeading: 'العقود الآجلة الدائمة للعملات الرقمية مع الرافعة',
    perpetualDesc: 'يمكن للمتداولين المتقدمين التداول بالرافعة المالية وفتح صفقات طويلة أو قصيرة والمزيد—في بضع نقرات.',
    securityTitle: 'أمان رائد في الصناعة. موثوق به من قبل أكثر من 26 مليون مستخدم.',
    getTheApp: 'احصل على التطبيق', followUs: 'تابعنا', downloadOn: 'تحميل على',
    android: 'أندرويد (APK)', googlePlay: 'Google Play',
    forexTrading: 'تداول الفوركس', cryptoTrading: 'تداول العملات الرقمية',
    copyTrading: 'نسخ التداول', propTrading: 'التداول الاحترافي', ibProgram: 'برنامج IB',
    forexDesc: 'تداول أزواج العملات الرئيسية والثانوية',
    cryptoTradeDesc: 'شراء وبيع وستاكينج الأصول الرقمية',
    copyDesc: 'انسخ كبار المتداولين تلقائيًا',
    propDesc: 'احصل على تمويل وتداول رأس مالنا',
    ibDesc: 'اكسب عمولات كوسيط معرّف',
  },
  HI: {
    whatWeOffer: 'हम क्या प्रदान करते हैं', support: 'सहायता', downloadApp: 'ऐप डाउनलोड करें',
    app: 'ऐप', logIn: 'लॉग इन', signUp: 'साइन अप',
    heroTitle: 'आपके सभी निवेशों के लिए एक जगह',
    heroSubtitle: 'निवेश शुरू करने के लिए आपको जो कुछ भी चाहिए वह यहाँ है। स्टॉक टोकन से लेकर क्रिप्टो तक—एक ही जगह पर खरीदें, बेचें और प्रबंधित करें।',
    getStarted: 'शुरू करें', learnMore: 'और जानें',
    investHeading: 'स्टॉक टोकन से शुरू करें',
    investDesc: 'NVIDIA, Microsoft, Apple, Vanguard S&P 500 ETF और अधिक से जुड़े 2,000+ स्टॉक टोकन एक्सप्लोर करें।',
    invest: 'निवेश', cryptoHeading: 'अपने पैसे के लिए अधिक क्रिप्टो प्राप्त करें',
    cryptoDesc: 'BTC, ETH और SOL जैसे लोकप्रिय क्रिप्टो को औसतन सबसे कम कीमत पर ट्रेड करें। 65+ क्रिप्टो एक्सप्लोर करें—सभी कम कीमत पर।',
    perpetualHeading: 'लीवरेज के साथ क्रिप्टो परपेचुअल फ्यूचर्स',
    perpetualDesc: 'उन्नत ट्रेडर्स लीवरेज के साथ ट्रेड कर सकते हैं, लॉन्ग या शॉर्ट पोजीशन खोल सकते हैं—कुछ ही टैप में।',
    securityTitle: 'उद्योग-अग्रणी सुरक्षा। 2.6 करोड़ से अधिक उपयोगकर्ताओं द्वारा भरोसेमंद।',
    getTheApp: 'ऐप प्राप्त करें', followUs: 'हमें फ़ॉलो करें', downloadOn: 'डाउनलोड करें',
    android: 'एंड्रॉइड (APK)', googlePlay: 'Google Play',
    forexTrading: 'फॉरेक्स ट्रेडिंग', cryptoTrading: 'क्रिप्टो ट्रेडिंग',
    copyTrading: 'कॉपी ट्रेडिंग', propTrading: 'प्रॉप ट्रेडिंग', ibProgram: 'IB प्रोग्राम',
    forexDesc: 'प्रमुख और छोटे मुद्रा जोड़े ट्रेड करें',
    cryptoTradeDesc: 'डिजिटल संपत्ति खरीदें, बेचें और स्टेक करें',
    copyTradeDesc: 'शीर्ष ट्रेडर्स को स्वचालित रूप से कॉपी करें',
    copyDesc: 'शीर्ष ट्रेडर्स को स्वचालित रूप से कॉपी करें',
    propDesc: 'फंडेड हों और हमारी पूंजी से ट्रेड करें',
    ibDesc: 'इंट्रोड्यूसिंग ब्रोकर के रूप में कमीशन कमाएं',
  },
}

const LanguageContext = createContext({ lang: 'EN', t: TRANSLATIONS.EN, setLang: () => {} })
const useT = () => useContext(LanguageContext)

// Hook to close dropdowns on outside click
const useClickOutside = (handler) => {
  const ref = useRef(null)
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) handler()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [handler])
  return ref
}

// What We Offer dropdown content
const OFFERINGS = [
  { key: 'forexTrading', descKey: 'forexDesc', Icon: TrendingUp },
  { key: 'cryptoTrading', descKey: 'cryptoTradeDesc', Icon: Bitcoin },
  { key: 'copyTrading', descKey: 'copyDesc', Icon: Users },
  { key: 'propTrading', descKey: 'propDesc', Icon: Briefcase },
  { key: 'ibProgram', descKey: 'ibDesc', Icon: Award },
]

// Navigation Component
const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const navigate = useNavigate()
  const { lang, t, setLang } = useT()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const offerRef = useClickOutside(() => setOfferOpen(false))
  const langRef = useClickOutside(() => setLangOpen(false))

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] transition-colors duration-300 h-[64px] flex items-center ${
        isScrolled ? 'bg-[#110E08] border-b border-[#2A2620]' : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-[24px] lg:px-[60px] flex items-center justify-between w-full">
        <div className="flex items-center gap-[34px]">
          <a href="/" className="flex items-center">
            <img src="/nalmifx.png" alt="NalmiFX Logo" className="h-[50px] w-auto object-contain" />
          </a>
          <div className="hidden md:flex items-center gap-[24px]">
            <div className="relative" ref={offerRef}>
              <button
                onClick={() => setOfferOpen((o) => !o)}
                className="flex items-center gap-[4px] text-white hover:text-[#CFF12F] transition-colors text-[16px] font-medium py-2"
              >
                {t.whatWeOffer}
                <ChevronDown size={16} className={`transition-transform ${offerOpen ? 'rotate-180' : ''}`} />
              </button>
              {offerOpen && (
                <div className="absolute top-full left-0 mt-2 w-[320px] bg-[#1a1610] border border-[#2A2620] rounded-[12px] shadow-2xl py-2 z-50">
                  {OFFERINGS.map(({ key, descKey, Icon, href }) => (
                    <a
                      key={key}
                      href={href}
                      onClick={() => setOfferOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-[#2A2620] transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#CFF12F]/10 flex items-center justify-center flex-shrink-0">
                        <Icon size={18} className="text-[#CFF12F]" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white text-[14px] font-semibold">{t[key]}</span>
                        <span className="text-[#999] text-[12px] leading-tight mt-0.5">{t[descKey]}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
            <a href="/support" className="text-white hover:text-[#CFF12F] transition-colors text-[16px] font-medium py-2">
              {t.support}
            </a>
          </div>
        </div>
        <div className="flex items-center gap-[12px] md:gap-[24px]">
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-[6px] bg-gradient-to-r from-[#CFF12F] to-[#a8c926] text-black px-[12px] md:px-[16px] py-[8px] rounded-[20px] text-[13px] md:text-[14px] font-semibold hover:brightness-110 transition-all whitespace-nowrap shadow-lg"
          >
            <Smartphone size={16} />
            <span className="hidden sm:inline">{t.downloadApp}</span>
            <span className="sm:hidden">{t.app}</span>
          </a>
          <div className="relative hidden md:block" ref={langRef}>
            <button
              onClick={() => setLangOpen((o) => !o)}
              className="flex items-center gap-[6px] text-white hover:text-[#CFF12F] transition-colors text-[14px] font-medium"
            >
              <Globe size={18} />
              <span className="hidden sm:inline">{lang}</span>
              <ChevronDown size={14} className={`hidden sm:inline transition-transform ${langOpen ? 'rotate-180' : ''}`} />
            </button>
            {langOpen && (
              <div className="absolute top-full right-0 mt-2 w-[180px] bg-[#1a1610] border border-[#2A2620] rounded-[12px] shadow-2xl py-1 z-50">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => { setLang(l.code); setLangOpen(false) }}
                    className={`w-full text-left px-4 py-2 text-[14px] transition-colors flex items-center justify-between ${
                      lang === l.code ? 'text-[#CFF12F] bg-[#2A2620]' : 'text-white hover:bg-[#2A2620]'
                    }`}
                  >
                    <span>{l.label}</span>
                    <span className="text-[12px] opacity-60">{l.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/user/login')}
            className="text-white hover:text-[#CFF12F] transition-colors text-[16px] font-medium hidden sm:block"
          >
            {t.logIn}
          </button>
          <button
            onClick={() => navigate('/user/signup')}
            className="bg-[#CFF12F] text-black px-[20px] py-[10px] rounded-[24px] text-[16px] font-bold hover:brightness-110 transition-all whitespace-nowrap"
          >
            {t.signUp}
          </button>
        </div>
      </div>
    </nav>
  )
}

// Hero Section
const HeroSection = () => {
  const navigate = useNavigate()
  const { t } = useT()

  return (
    <section className="relative w-full h-screen overflow-hidden bg-[#110E08]">
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
          poster="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/a30101db-b978-4ecc-8998-3de500870677-robinhood-com/assets/images/EU_Web_Landing_Hero_Desktop_Short-1.jpg"
        >
          <source
            src="https://videos.ctfassets.net/ilblxxee70tt/2s4toSMKFMvqnwyBZyS6LD/16627808bbf120f5a1264d23b1007278/EU_Web_Landing_Hero_Desktop_Short.webm"
            type="video/webm"
          />
        </video>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at center, rgba(17, 14, 8, 0) 0%, rgba(17, 14, 8, 0.4) 100%)' }}
        />
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full px-6 text-center">
        <div className="max-w-[1000px] flex flex-col items-center">
          <h1
            className="text-white mb-6"
            style={{ fontSize: 'clamp(3.5rem, 8vw, 5.25rem)', lineHeight: '1.1', fontWeight: 300, letterSpacing: '-0.02em' }}
          >
            {t.heroTitle}
          </h1>
          <p className="text-white text-lg md:text-xl font-normal max-w-[640px] mb-10 opacity-90" style={{ lineHeight: '1.6' }}>
            {t.heroSubtitle}
          </p>
          <button
            onClick={() => navigate('/user/signup')}
            className="inline-flex items-center justify-center bg-[#CFF12F] hover:bg-[#CFF12F]/90 active:scale-[0.98] transition-all duration-200 text-black px-8 py-3 rounded-full text-base font-medium min-w-[140px]"
          >
            {t.getStarted}
          </button>
        </div>
      </div>
    </section>
  )
}

// Invest Stock Tokens Section
const InvestStockTokens = () => {
  const { t } = useT()
  return (
    <section className="bg-[#CFF12F] text-black overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 md:px-[60px] py-20 md:py-[140px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-[120px] items-start">
          <div className="relative flex justify-center lg:justify-start">
            <div className="max-w-[540px] w-full">
              <img
                src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/a30101db-b978-4ecc-8998-3de500870677-robinhood-com/assets/images/home-invest-ui-desktop-2.png"
                alt="Explore Stock Tokens mobile app interface"
                className="w-full h-auto object-contain"
                loading="lazy"
              />
            </div>
          </div>
          <div className="flex flex-col max-w-[480px]">
            <h3 className="text-[18px] font-medium leading-[1.2] mb-6 tracking-tight opacity-80">{t.invest}</h3>
            <h2 className="text-[48px] md:text-[64px] font-light leading-[1.1] mb-8 tracking-[-0.02em]">
              {t.investHeading}
            </h2>
            <div className="text-[18px] leading-[1.6] mb-10 text-black/90">
              {t.investDesc}
            </div>
            <div className="mb-20">
              <a href="#" className="inline-block bg-black text-white px-8 py-[14px] rounded-[24px] font-medium text-[16px] hover:opacity-90 transition-opacity">
                {t.learnMore}
              </a>
            </div>
            <p className="text-[12px] leading-[1.6] text-black/70">
              Stock Tokens are derivative contracts between you and NalmiFX. They carry a high level of risk and are not appropriate for all investors.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// Crypto Promo Section
const CryptoPromo = () => {
  const { t } = useT()
  return (
    <section className="relative w-full min-h-[720px] lg:h-[840px] flex items-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/a30101db-b978-4ecc-8998-3de500870677-robinhood-com/assets/images/landing-crypto-desktop-3.jpeg"
          alt="Metallic chain detail"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 60%)' }} />
      </div>
      <div className="max-w-[1440px] mx-auto px-6 md:px-[60px] relative z-10">
        <div className="max-w-[480px]">
          <div className="mb-8 flex items-center gap-2">
            <span className="text-white text-[24px] font-medium">NalmiFX Crypto</span>
          </div>
          <h1 className="text-white text-[48px] md:text-[64px] mb-6 leading-[1.1] tracking-[-0.02em] font-light">
            {t.cryptoHeading}
          </h1>
          <p className="text-white text-[18px] leading-[1.6] opacity-90 mb-10 max-w-[420px]">
            {t.cryptoDesc}
          </p>
          <a href="#" className="inline-flex items-center justify-center bg-white text-black px-8 py-[12px] rounded-[24px] font-medium transition-opacity hover:opacity-90">
            {t.learnMore}
          </a>
        </div>
      </div>
    </section>
  )
}

// Perpetual Futures Section
const PerpetualFutures = () => {
  const { t } = useT()
  return (
    <section className="bg-black text-white py-[80px] md:py-[140px] overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-[24px] md:px-[60px]">
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-[64px] lg:gap-[80px]">
          <div className="w-full lg:w-1/2 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[500px]">
              <img
                src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/a30101db-b978-4ecc-8998-3de500870677-robinhood-com/assets/images/landing-futures-ui-desktop_2x-4.png"
                alt="Perpetual Futures trading interface"
                className="object-contain w-full h-auto"
              />
            </div>
          </div>
          <div className="w-full lg:w-[480px] flex flex-col pt-0 lg:pt-[40px]">
            <h3 className="text-[#999999] text-[14px] md:text-[18px] font-medium mb-[12px]">Perpetual Futures</h3>
            <h2 className="text-[40px] md:text-[48px] leading-[1.1] font-normal text-white mb-[24px]">
              {t.perpetualHeading}
            </h2>
            <p className="text-[16px] md:text-[18px] leading-[1.6] text-white mb-[32px]">
              {t.perpetualDesc}
            </p>
            <div className="mb-[48px]">
              <a href="#" className="inline-block bg-[#CFF12F] text-black text-[16px] font-semibold py-[12px] px-[24px] rounded-[24px] hover:opacity-90 transition-opacity">
                {t.learnMore}
              </a>
            </div>
            <p className="text-[12px] md:text-[14px] leading-[1.5] text-[#999999]">
              Perpetual futures are complex derivative products, and trading involves significant risk. Leveraged trading can amplify losses.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// Security Trust Section
const SecurityTrust = () => {
  const navigate = useNavigate()
  const { t } = useT()

  return (
    <section className="relative w-full min-h-[800px] flex items-center justify-center overflow-hidden bg-[#000000]">
      <div className="absolute inset-0 z-0 w-full h-full">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
          poster="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/a30101db-b978-4ecc-8998-3de500870677-robinhood-com/assets/images/Texture_1_Desktop-5.jpg"
        >
          <source src="https://videos.ctfassets.net/ilblxxee70tt/5RCR93puejnArBBUkpGUSb/49b64b6ca96cbb32b97d5a095b95393b/Texture_1_Desktop.webm" type="video/webm" />
        </video>
        <div className="absolute inset-0 z-10" style={{ background: 'radial-gradient(circle at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 100%)' }} />
      </div>
      <div className="relative z-20 max-w-[1440px] mx-auto px-[60px] text-center">
        <div className="flex flex-col items-center justify-center">
          <div className="h-[100px] md:h-[120px]" />
          <h2 className="text-white text-[48px] md:text-[64px] lg:text-[72px] leading-[1.05] tracking-[-0.03em] max-w-[900px] mx-auto mb-[40px]">
            {t.securityTitle}
          </h2>
          <button
            onClick={() => navigate('/user/signup')}
            className="inline-flex items-center justify-center bg-[#CFF12F] text-black text-[16px] font-medium px-[28px] py-[14px] rounded-[32px] hover:opacity-90 transition-opacity duration-200"
          >
            {t.getStarted}
          </button>
          <div className="h-[100px] md:h-[140px]" />
        </div>
      </div>
    </section>
  )
}

// Footer Section
const Footer = () => {
  const { t } = useT()
  const socialLinks = [
    { name: 'X', href: '#', path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.045 4.126H5.078z' },
    { name: 'Instagram', href: '#', path: 'M10 2.182c2.545 0 2.848.01 3.854.055 1.05.048 1.62.223 2 .37a3.35 3.35 0 0 1 1.242.808c.355.356.591.731.808 1.242.147.38.322.95.37 2 .045 1.006.055 1.309.055 3.854s-.01 2.848-.055 3.854c-.048 1.05-.223 1.62-.37 2a3.35 3.35 0 0 1-.808 1.242c-.356.355-.731.591-1.242.808-.38.147-.95.322-2 .37-1.006.045-1.309.055-3.854.055s-2.848-.01-3.854-.055c-1.05-.048-1.62-.223-2-.37a3.35 3.35 0 0 1-1.242-.808 3.35 3.35 0 0 1-.808-1.242c-.147-.38-.322-.95-.37-2-.045-1.006-.055-1.309-.055-3.854s.01-2.848.055-3.854c.048-1.05.223-1.62.37-2a3.35 3.35 0 0 1 .808-1.242c.356-.355.731-.591 1.242-.808.38-.147.95-.322 2-.37 1.006-.045 1.309-.055 3.854-.055zM10 0C7.412 0 7.087.01 6.07.057c-1.015.046-1.708.208-2.314.444a5.178 5.178 0 0 0-1.87 1.218A5.178 5.178 0 0 0 .673 3.59c-.236.606-.398 1.299-.444 2.314C.01 6.913 0 7.238 0 9.826s.01 2.913.057 3.93c.046 1.015.208 1.708.444 2.314a5.178 5.178 0 0 0 1.218 1.87 5.178 5.178 0 0 0 1.87 1.218c.606.236 1.299.398 2.314.444 1.017.047 1.342.057 3.93.057s2.913-.01 3.93-.057c1.015-.046 1.708-.208 2.314-.444a5.178 5.178 0 0 0 1.87-1.218 5.178 5.178 0 0 0 1.218-1.87c.236-.606.398-1.299.444-2.314.047-1.017.057-1.342.057-3.93s-.01-2.913-.057-3.93c-.046-1.015-.208-1.708-.444-2.314a5.178 5.178 0 0 0-1.218-1.87A5.178 5.178 0 0 0 16.063.5c-.606-.236-1.299-.398-2.314-.444C12.74 0 12.413 0 9.826 0H10zM10 4.773a5.053 5.053 0 1 0 0 10.106 5.053 5.053 0 0 0 0-10.106zm0 8.324a3.27 3.27 0 1 1 0-6.541 3.27 3.27 0 0 1 0 6.541zm5.253-9.043a1.213 1.213 0 1 1-2.426 0 1.213 1.213 0 0 1 2.426 0z' },
    { name: 'Facebook', href: '#', path: 'M20 10c0-5.523-4.477-10-10-10S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z' },
  ]

  return (
    <footer className="bg-[#CFF12F] text-[#000000] py-14 px-6 md:px-[60px]">
      <div className="max-w-[1440px] mx-auto">
        <div className="border-b border-black/10 pb-8 mb-12">
          {/* <p className="text-[14px] leading-[1.6] md:text-[18px]">
            Another year of progress, minted. Look back at what we've built in 2025.{' '}
            <a href="#" className="underline font-medium hover:opacity-70 transition-opacity">See highlights</a>.
          </p> */}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="flex flex-col">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-8 mb-12">
              <div>
                <h4 className="font-semibold text-[14px] mb-4">Product</h4>
                <ul className="space-y-3">
                  {['Forex Trading', 'Crypto Trading', 'Investments', 'IB Program'].map((item) => (
                    <li key={item}><a href="/signup" className="text-[14px] hover:underline">{item}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-[14px] mb-4">Cryptocurrencies</h4>
                <ul className="space-y-3 text-[14px]">
                  <li><a href="/cryptocurrencies" className="hover:underline">Bitcoin (BTC)</a></li>
                  <li><a href="/cryptocurrencies" className="hover:underline">Ethereum (ETH)</a></li>
                  <li><a href="/cryptocurrencies" className="hover:underline">Solana (SOL)</a></li>
                  <li><a href="/cryptocurrencies" className="hover:underline">See more</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-[14px] mb-4">Company</h4>
                <ul className="space-y-3 text-[14px]">
                  <li><a href="/about-us" className="hover:underline">About us</a></li>
                  <li><a href="/support" className="hover:underline">{t.support}</a></li>
                  <li><a href="/terms" className="hover:underline">Terms of Service</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-[14px] mb-4">Legal</h4>
                <ul className="space-y-3 text-[14px]">
                  <li><a href="/privacy" className="hover:underline">Privacy Policy</a></li>
                  <li><a href="/terms" className="hover:underline">Terms of Service</a></li>
                  <li><a href="/data-deletion" className="hover:underline">Data Deletion</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-auto">
              {/* Download App Section */}
              <div className="mb-8">
                <span className="text-[14px] font-medium block mb-4">{t.getTheApp}</span>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={PLAY_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 bg-black text-white px-5 py-3 rounded-xl hover:bg-black/80 transition-all group"
                  >
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                        <path fill="#34A853" d="M3.5 20.5l9.05-9.05 2.83 2.83L5.32 21.5a1.5 1.5 0 0 1-1.82-1z" />
                        <path fill="#FBBC04" d="M17.6 11.83l3.18-1.79c1.13-.64 1.13-2.27 0-2.91l-3.16-1.78-3.21 3.21 3.19 3.27z" />
                        <path fill="#EA4335" d="M3.5 3.5l11.88 11.88-2.83 2.83L3.5 9.32 3.5 3.5z" />
                        <path fill="#4285F4" d="M3.5 3.5a1.5 1.5 0 0 1 2.21-1.32L17.6 8.34l-3.21 3.21L3.5 3.5z" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] opacity-70">{t.downloadOn}</span>
                      <span className="text-[15px] font-semibold">{t.googlePlay}</span>
                    </div>
                  </a>
                  <a
                    href={APP_DOWNLOAD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 bg-black text-white px-5 py-3 rounded-xl hover:bg-black/80 transition-all group"
                  >
                    <div className="w-10 h-10 bg-[#CFF12F] rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Smartphone size={22} className="text-black" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] opacity-70">{t.downloadOn}</span>
                      <span className="text-[15px] font-semibold">{t.android}</span>
                    </div>
                  </a>
                </div>
              </div>
              <span className="text-[14px] font-medium block mb-4">{t.followUs}</span>
              <ul className="flex items-center gap-6">
                {socialLinks.map((social) => (
                  <li key={social.name}>
                    <a href={social.href} aria-label={social.name} className="hover:opacity-60 transition-opacity">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d={social.path} />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="space-y-6 text-[12px] leading-[1.6]">
            <p>
              Stock Tokens are derivative contracts between you and NalmiFX. They carry a high level of risk and are not appropriate for all investors.
            </p>
            <p>
              Perpetual futures are complex derivative products, and trading involves significant risk. Leveraged trading can amplify losses.
            </p>
            <p>support@nalmifx.com</p>
            <p>© 2026 NalmiFX. All rights reserved.</p>
          </div>
        </div>
        <div className="mt-20 flex justify-center select-none pointer-events-none pb-8">
          <h1 className="text-[18vw] lg:text-[20vw] font-bold leading-[1] tracking-tighter">
            NalmiFX
          </h1>
        </div>
      </div>
    </footer>
  )
}

// Main Landing Page Component
const LandingPage = () => {
  const [lang, setLang] = useState(() => localStorage.getItem('nalmifx_lang') || 'EN')
  const t = TRANSLATIONS[lang] || TRANSLATIONS.EN
  const isRTL = lang === 'AR'

  useEffect(() => {
    localStorage.setItem('nalmifx_lang', lang)
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, t, setLang }}>
      <div className="flex flex-col min-h-screen bg-[#110E08]" dir={isRTL ? 'rtl' : 'ltr'}>
        <Navigation />
        <main>
          <HeroSection />
          <InvestStockTokens />
          <CryptoPromo />
          <PerpetualFutures />
          <SecurityTrust />
        </main>
        <Footer />
      </div>
    </LanguageContext.Provider>
  )
}

export default LandingPage
