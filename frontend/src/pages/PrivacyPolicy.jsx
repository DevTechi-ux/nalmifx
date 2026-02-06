import React from 'react'
import { useNavigate } from 'react-router-dom'

const PrivacyPolicy = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="bg-black text-white py-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <span className="text-xl font-bold text-green-400">NalmiFX</span>
        </div>
        <nav className="flex gap-4 text-sm">
          <a href="/terms" className="hover:text-green-400 transition-colors">Terms of Service</a>
          <a href="/privacy" className="text-green-400 font-medium">Privacy Policy</a>
          <a href="/data-deletion" className="hover:text-green-400 transition-colors">Data Deletion</a>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">Last updated: February 7, 2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p>
              NalmiFX ("we," "our," or "us") operates the NalmiFX mobile application and web platform 
              (collectively, the "Service"). This Privacy Policy explains how we collect, use, disclose, 
              and safeguard your information when you use our Service, including our mobile application 
              available on the Google Play Store.
            </p>
            <p className="mt-2">
              By using the Service, you agree to the collection and use of information in accordance 
              with this Privacy Policy. If you do not agree with the terms of this Privacy Policy, 
              please do not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium mt-4 mb-2">2.1 Personal Information</h3>
            <p>When you register for an account, we may collect:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Full name (first name and last name)</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Date of birth</li>
              <li>Residential address</li>
              <li>Government-issued identification documents (for KYC verification)</li>
              <li>Selfie/photograph (for identity verification)</li>
              <li>Bank account details and UPI IDs (for deposits and withdrawals)</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">2.2 Financial Information</h3>
            <p>In the course of providing our trading services, we collect:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Transaction history (deposits, withdrawals, transfers)</li>
              <li>Trading activity and order history</li>
              <li>Payment screenshots and proof of transactions</li>
              <li>Wallet balance and account information</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">2.3 Device and Usage Information</h3>
            <p>We automatically collect certain information when you use our app:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Device type, operating system, and version</li>
              <li>Unique device identifiers</li>
              <li>IP address</li>
              <li>App usage patterns and interaction data</li>
              <li>Push notification tokens (if notifications are enabled)</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">2.4 Media and Files</h3>
            <p>With your explicit permission, we may access:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Photo library (for uploading payment screenshots and KYC documents)</li>
              <li>Camera (for capturing KYC selfie images)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <p>We use the collected information for the following purposes:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong>Account Management:</strong> To create, maintain, and manage your trading account</li>
              <li><strong>Identity Verification:</strong> To verify your identity through KYC (Know Your Customer) processes as required by financial regulations</li>
              <li><strong>Transaction Processing:</strong> To process deposits, withdrawals, and internal fund transfers</li>
              <li><strong>Trading Services:</strong> To execute and manage your forex trades, including copy trading functionality</li>
              <li><strong>Communication:</strong> To send you important account notifications, transaction confirmations, and service updates</li>
              <li><strong>Customer Support:</strong> To respond to your inquiries and resolve issues</li>
              <li><strong>Security:</strong> To detect and prevent fraud, unauthorized access, and other security threats</li>
              <li><strong>Compliance:</strong> To comply with applicable laws, regulations, and legal obligations</li>
              <li><strong>Service Improvement:</strong> To analyze usage patterns and improve our platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Storage and Security</h2>
            <p>
              We implement industry-standard security measures to protect your personal information, including:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Encrypted data transmission using SSL/TLS protocols</li>
              <li>Secure password hashing (bcrypt)</li>
              <li>Secure token-based authentication (JWT)</li>
              <li>Encrypted local storage on mobile devices (Expo SecureStore)</li>
              <li>Regular security audits and monitoring</li>
            </ul>
            <p className="mt-2">
              Your data is stored on secure servers. While we strive to use commercially acceptable means 
              to protect your personal information, no method of transmission over the Internet or electronic 
              storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Sharing and Disclosure</h2>
            <p>We do not sell, trade, or rent your personal information to third parties. We may share your information in the following circumstances:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong>Legal Requirements:</strong> When required by law, regulation, or legal process</li>
              <li><strong>Regulatory Compliance:</strong> With financial regulatory authorities as required</li>
              <li><strong>Service Providers:</strong> With trusted third-party service providers who assist in operating our platform (e.g., payment processors, cloud hosting), subject to confidentiality agreements</li>
              <li><strong>Safety:</strong> To protect the rights, property, or safety of NalmiFX, our users, or others</li>
              <li><strong>Consent:</strong> With your explicit consent for any other purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Your Rights and Choices</h2>
            <p>You have the following rights regarding your personal data:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong>Access:</strong> You can request a copy of your personal data we hold</li>
              <li><strong>Correction:</strong> You can update or correct your personal information through your account settings</li>
              <li><strong>Deletion:</strong> You can request deletion of your account and associated data (see our <a href="/data-deletion" className="text-green-600 underline">Data Deletion Policy</a>)</li>
              <li><strong>Notification Preferences:</strong> You can opt out of push notifications through your device settings</li>
              <li><strong>Withdraw Consent:</strong> You can withdraw consent for data processing at any time by contacting us</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to 
              provide you services. We may also retain certain information as required by law, for legitimate 
              business purposes, or to resolve disputes. Financial transaction records are retained for a 
              minimum of 5 years as required by financial regulations.
            </p>
            <p className="mt-2">
              Upon account deletion, we will delete or anonymize your personal data within 30 days, except 
              where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Children's Privacy</h2>
            <p>
              Our Service is not intended for individuals under the age of 18. We do not knowingly collect 
              personal information from children under 18. If we become aware that we have collected personal 
              data from a child under 18, we will take steps to delete that information promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Permissions Used</h2>
            <p>Our mobile application requests the following permissions:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong>Internet Access:</strong> Required for all app functionality, including trading, account management, and real-time price updates</li>
              <li><strong>Photo Library Access:</strong> Used only when you choose to upload payment screenshots or KYC documents</li>
              <li><strong>Camera Access:</strong> Used only when you choose to capture a selfie for KYC verification</li>
              <li><strong>Push Notifications:</strong> Used to send you trade alerts, transaction updates, and important account notifications (optional)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by 
              posting the new Privacy Policy on this page and updating the "Last updated" date. You are 
              advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy or our data practices, please contact us:</p>
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

export default PrivacyPolicy
