import React from 'react'
import { useNavigate } from 'react-router-dom'

const TermsOfService = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="bg-black text-white py-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <span className="text-xl font-bold text-green-400">NalmiFX</span>
        </div>
        <nav className="flex gap-4 text-sm">
          <a href="/terms" className="text-green-400 font-medium">Terms of Service</a>
          <a href="/privacy" className="hover:text-green-400 transition-colors">Privacy Policy</a>
          <a href="/data-deletion" className="hover:text-green-400 transition-colors">Data Deletion</a>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-500 mb-8">Last updated: February 7, 2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p>
              By downloading, installing, or using the NalmiFX mobile application or web platform 
              (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms"). 
              If you do not agree to these Terms, do not use the Service.
            </p>
            <p className="mt-2">
              NalmiFX reserves the right to modify these Terms at any time. Continued use of the Service 
              after any modifications constitutes your acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Eligibility</h2>
            <p>To use the Service, you must:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Be at least 18 years of age</li>
              <li>Have the legal capacity to enter into a binding agreement</li>
              <li>Not be prohibited from using the Service under applicable laws</li>
              <li>Complete the registration process and provide accurate, current, and complete information</li>
              <li>Complete KYC (Know Your Customer) verification as required</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Account Registration and Security</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials. 
              You agree to:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Provide accurate and truthful information during registration</li>
              <li>Keep your password secure and not share it with anyone</li>
              <li>Notify us immediately of any unauthorized access to your account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
              <li>Not create multiple accounts for the same individual</li>
            </ul>
            <p className="mt-2">
              We reserve the right to suspend or terminate accounts that violate these Terms or 
              are suspected of fraudulent activity.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Services Provided</h2>
            <p>NalmiFX provides the following services through its platform:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong>Forex Trading:</strong> Access to forex currency pair trading with real-time market data</li>
              <li><strong>Trading Accounts:</strong> Creation and management of multiple trading accounts with various account types</li>
              <li><strong>Wallet Services:</strong> Digital wallet for deposits, withdrawals, and fund transfers</li>
              <li><strong>Copy Trading:</strong> Ability to follow and copy trades from other traders</li>
              <li><strong>Introducing Broker (IB) Program:</strong> Referral and commission-based partnership program</li>
              <li><strong>Prop Trading Challenges:</strong> Funded trading account challenges and evaluations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Trading Risks</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="font-semibold text-red-700 mb-2">⚠️ Risk Warning</p>
              <p className="text-red-700">
                Trading forex and other financial instruments involves substantial risk of loss and is not 
                suitable for all investors. You should carefully consider whether trading is appropriate for 
                you in light of your financial condition. You may lose some or all of your invested capital. 
                Past performance is not indicative of future results.
              </p>
            </div>
            <p>By using our trading services, you acknowledge that:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Trading involves significant risk of financial loss</li>
              <li>Leveraged trading can result in losses exceeding your initial deposit</li>
              <li>Market conditions can change rapidly and unpredictably</li>
              <li>You are solely responsible for your trading decisions</li>
              <li>NalmiFX does not provide financial advice or recommendations</li>
              <li>Historical performance does not guarantee future results</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Deposits and Withdrawals</h2>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>All deposits and withdrawals are subject to verification and approval</li>
              <li>You must use payment methods registered in your own name</li>
              <li>Processing times may vary depending on the payment method</li>
              <li>We reserve the right to request additional verification for large transactions</li>
              <li>Minimum deposit and withdrawal amounts may apply</li>
              <li>Transaction fees may apply as specified on the platform</li>
              <li>Payment screenshots may be required as proof of transaction</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. KYC (Know Your Customer) Verification</h2>
            <p>
              To comply with regulatory requirements and prevent fraud, we require users to complete 
              KYC verification. This process includes:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Submission of a valid government-issued photo ID (front and back)</li>
              <li>A selfie photograph for identity verification</li>
              <li>Proof of address (if required)</li>
            </ul>
            <p className="mt-2">
              Certain features and transaction limits may be restricted until KYC verification is completed. 
              We reserve the right to reject KYC submissions that do not meet our verification standards.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Prohibited Activities</h2>
            <p>You agree not to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Manipulate or attempt to manipulate trading prices or markets</li>
              <li>Use automated systems, bots, or scripts to interact with the Service without authorization</li>
              <li>Provide false or misleading information</li>
              <li>Attempt to gain unauthorized access to other users' accounts</li>
              <li>Engage in money laundering or terrorist financing activities</li>
              <li>Reverse engineer, decompile, or disassemble the Service</li>
              <li>Use the Service to transmit malware or harmful code</li>
              <li>Interfere with or disrupt the Service or its servers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Intellectual Property</h2>
            <p>
              All content, features, and functionality of the Service, including but not limited to text, 
              graphics, logos, icons, images, and software, are the exclusive property of NalmiFX and are 
              protected by copyright, trademark, and other intellectual property laws.
            </p>
            <p className="mt-2">
              You are granted a limited, non-exclusive, non-transferable license to use the Service for 
              personal, non-commercial purposes in accordance with these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, NalmiFX shall not be liable for any indirect, 
              incidental, special, consequential, or punitive damages, including but not limited to:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Loss of profits, data, or business opportunities</li>
              <li>Trading losses resulting from market conditions</li>
              <li>Service interruptions or technical failures</li>
              <li>Unauthorized access to your account due to your negligence</li>
              <li>Actions of third-party service providers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Account Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time if we believe you 
              have violated these Terms or engaged in fraudulent or illegal activity. Upon termination:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>All open positions may be closed at current market prices</li>
              <li>Remaining funds (after deducting any fees or losses) will be returned to you</li>
              <li>Your access to the Service will be revoked</li>
              <li>We may retain certain data as required by law</li>
            </ul>
            <p className="mt-2">
              You may also request to close your account at any time by contacting our support team.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable laws. 
              Any disputes arising from these Terms or the use of the Service shall be resolved 
              through good-faith negotiation, and if necessary, through binding arbitration.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Contact Us</h2>
            <p>If you have any questions about these Terms of Service, please contact us:</p>
            <ul className="list-none mt-2 space-y-1">
              <li><strong>Email:</strong> support@nalmifx.com</li>
              <li><strong>Website:</strong> <a href="https://nalmifx.com" className="text-green-600 underline">https://nalmifx.com</a></li>
              <li><strong>In-App Support:</strong> Available through the Support section in the app</li>
            </ul>
          </section>
        </div>
      </main>

      <footer className="bg-gray-100 border-t py-6 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} NalmiFX. All rights reserved.</p>
        <div className="flex justify-center gap-4 mt-2">
          <a href="/privacy" className="hover:text-gray-700">Privacy Policy</a>
          <a href="/terms" className="hover:text-gray-700">Terms of Service</a>
          <a href="/data-deletion" className="hover:text-gray-700">Data Deletion</a>
        </div>
      </footer>
    </div>
  )
}

export default TermsOfService
