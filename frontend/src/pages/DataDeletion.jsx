import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const DataDeletion = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="bg-black text-white py-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <span className="text-xl font-bold text-green-400">NalmiFX</span>
        </div>
        <nav className="flex gap-4 text-sm">
          <a href="/terms" className="hover:text-green-400 transition-colors">Terms of Service</a>
          <a href="/privacy" className="hover:text-green-400 transition-colors">Privacy Policy</a>
          <a href="/data-deletion" className="text-green-400 font-medium">Data Deletion</a>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Data Deletion Policy</h1>
        <p className="text-gray-500 mb-8">Last updated: February 7, 2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3">Your Right to Data Deletion</h2>
            <p>
              At NalmiFX, we respect your right to control your personal data. You may request the 
              deletion of your account and all associated personal data at any time. This page explains 
              the data deletion process, what data will be deleted, and what data may be retained as 
              required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">How to Request Data Deletion</h2>
            <p>You can request deletion of your data through any of the following methods:</p>
            <ul className="list-disc ml-6 mt-2 space-y-2">
              <li>
                <strong>In-App Request:</strong> Navigate to the Support section within the NalmiFX app 
                and submit a data deletion request
              </li>
              <li>
                <strong>Email Request:</strong> Send an email to{' '}
                <a href="mailto:support@nalmifx.com" className="text-green-600 underline">support@nalmifx.com</a>{' '}
                with the subject line "Data Deletion Request" and include your registered email address
              </li>
              <li>
                <strong>Online Form:</strong> Use the form below to submit your data deletion request
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">What Data Will Be Deleted</h2>
            <p>Upon processing your deletion request, the following data will be permanently deleted:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Your account profile information (name, email, phone number, address)</li>
              <li>KYC verification documents (ID images, selfie photographs)</li>
              <li>Profile images</li>
              <li>Payment screenshots</li>
              <li>Support ticket conversations</li>
              <li>Notification preferences and push notification tokens</li>
              <li>Trading account configurations and preferences</li>
              <li>Copy trading subscriptions and IB referral data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">What Data May Be Retained</h2>
            <p>
              Certain data may be retained for a limited period as required by financial regulations 
              and legal obligations:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>
                <strong>Financial transaction records:</strong> Deposit, withdrawal, and trade history 
                may be retained for up to 5 years as required by financial regulatory compliance
              </li>
              <li>
                <strong>Anti-money laundering records:</strong> Certain identity verification records 
                may be retained as required by AML regulations
              </li>
              <li>
                <strong>Legal dispute records:</strong> Data related to any ongoing legal disputes or 
                investigations will be retained until resolution
              </li>
            </ul>
            <p className="mt-2">
              Retained data will be anonymized where possible and will only be accessible for 
              regulatory compliance purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Processing Timeline</h2>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>We will acknowledge your deletion request within <strong>2 business days</strong></li>
              <li>Identity verification may be required to process the request</li>
              <li>All open trading positions must be closed before account deletion</li>
              <li>Any remaining wallet balance will be withdrawn to your registered payment method</li>
              <li>Data deletion will be completed within <strong>30 days</strong> of request verification</li>
              <li>You will receive a confirmation email once the deletion is complete</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Important Notes</h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <ul className="list-disc ml-4 space-y-2 text-yellow-800">
                <li>Account deletion is <strong>permanent and irreversible</strong></li>
                <li>All trading history and account data will be lost</li>
                <li>Any active subscriptions or IB partnerships will be terminated</li>
                <li>Pending deposits or withdrawals must be resolved before deletion</li>
                <li>You will need to create a new account if you wish to use NalmiFX again</li>
              </ul>
            </div>
          </section>

          {/* Data Deletion Request Form */}
          <section>
            <h2 className="text-xl font-semibold mb-3">Submit a Data Deletion Request</h2>
            {submitted ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <div className="text-green-600 text-4xl mb-3">✓</div>
                <h3 className="text-lg font-semibold text-green-700 mb-2">Request Submitted</h3>
                <p className="text-green-600">
                  Your data deletion request has been received. We will send a confirmation to your 
                  email address within 2 business days. Please check your inbox (and spam folder) for 
                  further instructions.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Registered Email Address *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Enter your registered email"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Deletion (Optional)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Please let us know why you'd like to delete your data"
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Submit Deletion Request
                </button>
              </form>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
            <p>If you have any questions about data deletion, please contact us:</p>
            <ul className="list-none mt-2 space-y-1">
              <li><strong>Email:</strong> support@nalmifx.com</li>
              <li><strong>Website:</strong> <a href="https://nalmifx.com" className="text-green-600 underline">https://nalmifx.com</a></li>
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

export default DataDeletion
