import React, { useState, useEffect } from 'react'
import userFetch from '../utils/userFetch.js'
import { useNavigate } from 'react-router-dom'
import {
  Trophy, Target, TrendingUp, TrendingDown, Clock, AlertTriangle,
  ChevronRight, Activity, BarChart3, Shield, Calendar, XCircle,
  CheckCircle, AlertCircle, RefreshCw, Wallet, DollarSign, Lock
} from 'lucide-react'
import { API_URL } from '../config/api'

export default function ChallengeDashboardPage() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fundedInfo, setFundedInfo] = useState(null)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    if (user._id) {
      fetchAccounts()
    }
  }, [user._id])

  useEffect(() => {
    if (selectedAccount) {
      fetchDashboard(selectedAccount._id)
    }
  }, [selectedAccount])

  const fetchAccounts = async () => {
    try {
      const res = await userFetch(`${API_URL}/prop/my-accounts/${user._id}`)
      const data = await res.json()
      if (data.success && data.accounts.length > 0) {
        setAccounts(data.accounts)
        setSelectedAccount(data.accounts[0])
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
    }
    setLoading(false)
  }

  const fetchDashboard = async (accountId) => {
    try {
      const res = await userFetch(`${API_URL}/prop/account/${accountId}`)
      const data = await res.json()
      if (data.success) {
        setDashboard(data)
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error)
    }
  }

  const fetchFundedInfo = async (accountId) => {
    try {
      const res = await userFetch(`${API_URL}/prop/funded-info/${accountId}`)
      const data = await res.json()
      if (data.success) {
        setFundedInfo(data.fundedInfo)
      }
    } catch (error) {
      setFundedInfo(null)
    }
  }

  useEffect(() => {
    if (selectedAccount && selectedAccount.accountType === 'FUNDED') {
      fetchFundedInfo(selectedAccount._id)
    } else {
      setFundedInfo(null)
    }
  }, [selectedAccount])

  const handleWithdrawProfit = async () => {
    const amt = parseFloat(withdrawAmount)
    if (!amt || amt <= 0) return alert('Enter a valid amount')
    if (amt > (fundedInfo?.withdrawableAmount || 0)) return alert(`Maximum withdrawable: $${fundedInfo.withdrawableAmount.toFixed(2)}`)

    setWithdrawing(true)
    try {
      const res = await userFetch(`${API_URL}/prop/withdraw-profit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          challengeAccountId: selectedAccount._id,
          amount: amt
        })
      })
      const data = await res.json()
      if (data.success) {
        alert(data.message)
        setShowWithdrawModal(false)
        setWithdrawAmount('')
        fetchDashboard(selectedAccount._id)
        fetchFundedInfo(selectedAccount._id)
      } else {
        alert(data.message || 'Withdrawal failed')
      }
    } catch (error) {
      alert('Withdrawal failed')
    }
    setWithdrawing(false)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return 'bg-blue-500/20 text-blue-500'
      case 'PASSED': return 'bg-green-500/20 text-green-500'
      case 'FUNDED': return 'bg-purple-500/20 text-purple-500'
      case 'FAILED': return 'bg-red-500/20 text-red-500'
      case 'EXPIRED': return 'bg-gray-500/20 text-gray-500'
      default: return 'bg-gray-500/20 text-gray-500'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ACTIVE': return Activity
      case 'PASSED': return CheckCircle
      case 'FUNDED': return Trophy
      case 'FAILED': return XCircle
      case 'EXPIRED': return Clock
      default: return AlertCircle
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Trophy size={64} className="text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">No Challenge Accounts</h2>
          <p className="text-gray-400 mb-6">You haven't purchased any challenges yet.</p>
          <button
            onClick={() => navigate('/buy-challenge')}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl transition-colors"
          >
            Buy Challenge
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-900 p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Challenge Dashboard</h1>
            <p className="text-gray-400">Monitor your prop trading progress</p>
          </div>
          <button
            onClick={() => navigate('/buy-challenge')}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Trophy size={18} />
            New Challenge
          </button>
        </div>

        {/* Account Selector */}
        {accounts.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {accounts.map((acc) => {
              const StatusIcon = getStatusIcon(acc.status)
              return (
                <button
                  key={acc._id}
                  onClick={() => setSelectedAccount(acc)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    selectedAccount?._id === acc._id
                      ? 'bg-primary-500 text-white'
                      : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                  }`}
                >
                  <StatusIcon size={16} />
                  {acc.accountId}
                </button>
              )
            })}
          </div>
        )}

        {dashboard && (
          <>
            {/* Status Banner */}
            {dashboard.account.status === 'FAILED' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
                <XCircle size={24} className="text-red-500" />
                <div>
                  <p className="text-red-500 font-bold">Challenge Failed</p>
                  <p className="text-gray-400 text-sm">
                    {dashboard.violations?.find(v => v.severity === 'FAIL')?.description || 'Rule violation detected'}
                  </p>
                </div>
              </div>
            )}

            {dashboard.account.status === 'PASSED' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
                <CheckCircle size={24} className="text-green-500" />
                <div>
                  <p className="text-green-500 font-bold">Challenge Passed!</p>
                  <p className="text-gray-400 text-sm">Congratulations! Your funded account is being prepared.</p>
                </div>
              </div>
            )}

            {dashboard.account.status === 'FUNDED' && fundedInfo && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Trophy size={24} className="text-purple-500" />
                    <div>
                      <p className="text-purple-500 font-bold text-lg">Funded Account</p>
                      <p className="text-gray-400 text-sm">Trade with real capital. Withdraw your profits anytime.</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-500 rounded-full text-sm font-medium">
                    {fundedInfo.profitSplitPercent}% Profit Split
                  </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="bg-dark-800 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Lock size={14} className="text-gray-500" />
                      <p className="text-gray-400 text-sm">Capital (Locked)</p>
                    </div>
                    <p className="text-white font-bold">${fundedInfo.initialCapital.toLocaleString()}</p>
                  </div>
                  <div className="bg-dark-800 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingUp size={14} className="text-green-500" />
                      <p className="text-gray-400 text-sm">Total Profit</p>
                    </div>
                    <p className={`font-bold ${fundedInfo.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      ${fundedInfo.totalProfit.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-dark-800 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <DollarSign size={14} className="text-yellow-500" />
                      <p className="text-gray-400 text-sm">Your Share ({fundedInfo.profitSplitPercent}%)</p>
                    </div>
                    <p className="text-yellow-500 font-bold">${fundedInfo.withdrawableAmount.toFixed(2)}</p>
                  </div>
                  <div className="bg-dark-800 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Wallet size={14} className="text-blue-500" />
                      <p className="text-gray-400 text-sm">Total Withdrawn</p>
                    </div>
                    <p className="text-white font-bold">${(fundedInfo.totalWithdrawn || 0).toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setWithdrawAmount(''); setShowWithdrawModal(true) }}
                    disabled={!fundedInfo.canWithdraw || fundedInfo.withdrawableAmount <= 0}
                    className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Wallet size={16} />
                    Withdraw Profit
                  </button>
                  {!fundedInfo.canWithdraw && fundedInfo.nextWithdrawalDate && (
                    <p className="text-gray-500 text-sm">
                      Next withdrawal: {new Date(fundedInfo.nextWithdrawalDate).toLocaleDateString()}
                    </p>
                  )}
                  {fundedInfo.withdrawableAmount <= 0 && fundedInfo.canWithdraw && (
                    <p className="text-gray-500 text-sm">No profit available to withdraw</p>
                  )}
                </div>
              </div>
            )}

            {/* Main Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-400 text-sm mb-1">Equity</p>
                <p className="text-2xl font-bold text-white">${dashboard.balance.equity.toLocaleString()}</p>
                <p className={`text-sm ${dashboard.balance.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {dashboard.balance.profitLoss >= 0 ? '+' : ''}${dashboard.balance.profitLoss.toFixed(2)}
                </p>
              </div>
              <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-400 text-sm mb-1">Phase</p>
                <p className="text-2xl font-bold text-white">
                  {dashboard.account.totalPhases === 0 ? 'Funded' : `${dashboard.account.currentPhase}/${dashboard.account.totalPhases}`}
                </p>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(dashboard.account.status)}`}>
                  {dashboard.account.status}
                </span>
              </div>
              <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-400 text-sm mb-1">Days Left</p>
                <p className="text-2xl font-bold text-white">{dashboard.time.remainingDays}</p>
                <p className="text-gray-500 text-sm">of {dashboard.challenge.stepsCount === 0 ? '∞' : '30'} days</p>
              </div>
              <div className="bg-dark-800 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-400 text-sm mb-1">Trading Days</p>
                <p className="text-2xl font-bold text-white">{dashboard.trades.tradingDays}</p>
                <p className="text-gray-500 text-sm">
                  {dashboard.trades.requiredDays ? `min ${dashboard.trades.requiredDays} required` : 'No minimum'}
                </p>
              </div>
            </div>

            {/* Drawdown & Profit Progress */}
            <div className="grid lg:grid-cols-2 gap-6 mb-6">
              {/* Drawdown Card */}
              <div className="bg-dark-800 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Shield size={20} className="text-red-500" />
                  Drawdown Limits
                </h3>
                
                {/* Daily Drawdown */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Daily Drawdown</span>
                    <span className="text-white">
                      {dashboard.drawdown.dailyUsed.toFixed(2)}% / {dashboard.drawdown.dailyMax}%
                    </span>
                  </div>
                  <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        dashboard.drawdown.dailyUsed >= dashboard.drawdown.dailyMax * 0.8 
                          ? 'bg-red-500' 
                          : dashboard.drawdown.dailyUsed >= dashboard.drawdown.dailyMax * 0.5 
                            ? 'bg-yellow-500' 
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, (dashboard.drawdown.dailyUsed / dashboard.drawdown.dailyMax) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {dashboard.drawdown.dailyRemaining.toFixed(2)}% remaining
                  </p>
                </div>

                {/* Overall Drawdown */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Overall Drawdown</span>
                    <span className="text-white">
                      {dashboard.drawdown.overallUsed.toFixed(2)}% / {dashboard.drawdown.overallMax}%
                    </span>
                  </div>
                  <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        dashboard.drawdown.overallUsed >= dashboard.drawdown.overallMax * 0.8 
                          ? 'bg-red-500' 
                          : dashboard.drawdown.overallUsed >= dashboard.drawdown.overallMax * 0.5 
                            ? 'bg-yellow-500' 
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, (dashboard.drawdown.overallUsed / dashboard.drawdown.overallMax) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {dashboard.drawdown.overallRemaining.toFixed(2)}% remaining
                  </p>
                </div>
              </div>

              {/* Profit Target Card */}
              <div className="bg-dark-800 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Target size={20} className="text-green-500" />
                  Profit Target
                </h3>
                
                {dashboard.profit.targetPercent > 0 ? (
                  <>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Progress</span>
                      <span className="text-white">
                        {dashboard.profit.currentPercent.toFixed(2)}% / {dashboard.profit.targetPercent}%
                      </span>
                    </div>
                    <div className="h-3 bg-dark-700 rounded-full overflow-hidden mb-2">
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, dashboard.profit.targetProgress)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      ${Math.max(0, dashboard.profit.amountToTarget).toFixed(2)} to target
                    </p>

                    <div className="mt-4 p-3 bg-dark-700 rounded-lg">
                      <p className="text-gray-400 text-sm">Target Amount</p>
                      <p className="text-xl font-bold text-green-500">
                        ${((dashboard.profit.targetPercent / 100) * dashboard.balance.initial).toLocaleString()}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <Trophy size={32} className="text-purple-500 mx-auto mb-2" />
                    <p className="text-white font-medium">Instant Funded Account</p>
                    <p className="text-gray-400 text-sm">No profit target - just follow the rules</p>
                  </div>
                )}
              </div>
            </div>

            {/* Trade Limits */}
            <div className="bg-dark-800 rounded-xl p-6 border border-gray-800 mb-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-primary-500" />
                Trade Limits
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-dark-700 rounded-lg p-3">
                  <p className="text-gray-400 text-sm">Trades Today</p>
                  <p className="text-xl font-bold text-white">
                    {dashboard.trades.today}
                    {dashboard.trades.maxPerDay && <span className="text-gray-500">/{dashboard.trades.maxPerDay}</span>}
                  </p>
                </div>
                <div className="bg-dark-700 rounded-lg p-3">
                  <p className="text-gray-400 text-sm">Open Trades</p>
                  <p className="text-xl font-bold text-white">
                    {dashboard.trades.openCount}
                    {dashboard.trades.maxConcurrent && <span className="text-gray-500">/{dashboard.trades.maxConcurrent}</span>}
                  </p>
                </div>
                <div className="bg-dark-700 rounded-lg p-3">
                  <p className="text-gray-400 text-sm">Total Trades</p>
                  <p className="text-xl font-bold text-white">{dashboard.trades.total}</p>
                </div>
                <div className="bg-dark-700 rounded-lg p-3">
                  <p className="text-gray-400 text-sm">Min Hold Time</p>
                  <p className="text-xl font-bold text-white">
                    {dashboard.rules.minHoldTimeSeconds > 0 ? `${dashboard.rules.minHoldTimeSeconds}s` : 'None'}
                  </p>
                </div>
              </div>
            </div>

            {/* Rules & Warnings */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Active Rules */}
              <div className="bg-dark-800 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-bold text-white mb-4">Active Rules</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      dashboard.rules.stopLossMandatory ? 'bg-red-500/20' : 'bg-gray-700'
                    }`}>
                      <Shield size={16} className={dashboard.rules.stopLossMandatory ? 'text-red-500' : 'text-gray-500'} />
                    </div>
                    <div>
                      <p className="text-white text-sm">Stop Loss Mandatory</p>
                      <p className="text-gray-500 text-xs">
                        {dashboard.rules.stopLossMandatory ? 'Required on all trades' : 'Not required'}
                      </p>
                    </div>
                  </div>
                  {dashboard.rules.allowedSymbols?.length > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Activity size={16} className="text-blue-500" />
                      </div>
                      <div>
                        <p className="text-white text-sm">Allowed Symbols</p>
                        <p className="text-gray-500 text-xs">{dashboard.rules.allowedSymbols.join(', ')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Violations */}
              <div className="bg-dark-800 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-yellow-500" />
                  Violations ({dashboard.violations?.length || 0})
                </h3>
                {dashboard.violations?.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {dashboard.violations.map((v, i) => (
                      <div 
                        key={i} 
                        className={`p-3 rounded-lg ${
                          v.severity === 'FAIL' ? 'bg-red-500/10 border border-red-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'
                        }`}
                      >
                        <p className={`text-sm font-medium ${v.severity === 'FAIL' ? 'text-red-500' : 'text-yellow-500'}`}>
                          {v.rule}
                        </p>
                        <p className="text-gray-400 text-xs">{v.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
                    <p className="text-gray-400">No violations - keep it up!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Trade Button */}
            {(dashboard.account.status === 'ACTIVE' || dashboard.account.status === 'FUNDED') && (
              <div className="mt-6">
                <button
                  onClick={() => navigate('/trading')}
                  className="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <TrendingUp size={20} />
                  {dashboard.account.status === 'FUNDED' ? 'Trade Funded Account' : 'Start Trading'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Withdraw Profit Modal */}
      {showWithdrawModal && fundedInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Withdraw Profit</h2>
              <button onClick={() => setShowWithdrawModal(false)} className="text-gray-400 hover:text-white">
                <XCircle size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-dark-700 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Profit</span>
                  <span className="text-white">${fundedInfo.totalProfit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Your Share ({fundedInfo.profitSplitPercent}%)</span>
                  <span className="text-green-500 font-medium">${fundedInfo.withdrawableAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Platform Share ({100 - fundedInfo.profitSplitPercent}%)</span>
                  <span className="text-gray-400">${(fundedInfo.totalProfit - fundedInfo.withdrawableAmount).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Withdrawal Amount ($)</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={`Max: $${fundedInfo.withdrawableAmount.toFixed(2)}`}
                  max={fundedInfo.withdrawableAmount}
                  min={0.01}
                  step="0.01"
                  className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                />
                <button
                  onClick={() => setWithdrawAmount(fundedInfo.withdrawableAmount.toFixed(2))}
                  className="text-primary-500 text-sm mt-1 hover:underline"
                >
                  Withdraw max
                </button>
              </div>

              <p className="text-gray-500 text-xs">
                Profit will be credited to your wallet. Capital of ${fundedInfo.initialCapital.toLocaleString()} remains locked in the funded account. Same drawdown rules still apply.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 py-3 bg-dark-700 text-white rounded-lg hover:bg-dark-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWithdrawProfit}
                  disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                  className="flex-1 py-3 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {withdrawing ? 'Processing...' : 'Confirm Withdrawal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
