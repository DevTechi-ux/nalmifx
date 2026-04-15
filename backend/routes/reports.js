import express from 'express'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import User from '../models/User.js'
import Transaction from '../models/Transaction.js'
import Admin from '../models/Admin.js'
import Trade from '../models/Trade.js'
import ChallengeAccount from '../models/ChallengeAccount.js'
import { getScopedUserIds, scopeToAdmin } from '../middleware/auth.js'

const router = express.Router()

// Helper: build date filter from period query param
function getDateFilter(period) {
  const now = new Date()
  if (period === 'daily') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { $gte: start }
  }
  if (period === 'weekly') {
    const start = new Date(now)
    start.setDate(start.getDate() - 7)
    start.setHours(0, 0, 0, 0)
    return { $gte: start }
  }
  return null // all time
}

// Helper: style Excel header row
function styleHeader(sheet) {
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 28
  sheet.columns.forEach(col => { col.width = Math.max(col.width || 12, 14) })
}

// Helper: generate PDF table from rows
function buildPDF(res, title, headers, rows, filename) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  doc.pipe(res)

  // Title
  doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' })
  doc.moveDown(0.3)
  doc.fontSize(9).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
  doc.moveDown(0.8)

  // Calculate column widths
  const tableWidth = doc.page.width - 60
  const colWidth = tableWidth / headers.length

  // Header row
  const startX = 30
  let y = doc.y
  doc.font('Helvetica-Bold').fontSize(8)
  headers.forEach((h, i) => {
    doc.rect(startX + i * colWidth, y, colWidth, 18).fill('#1F2937')
    doc.fill('#FFFFFF').text(h, startX + i * colWidth + 4, y + 5, { width: colWidth - 8, ellipsis: true })
  })
  y += 18
  doc.fill('#000000')

  // Data rows
  doc.font('Helvetica').fontSize(7)
  rows.forEach((row, ri) => {
    if (y > doc.page.height - 50) {
      doc.addPage()
      y = 30
    }
    const bgColor = ri % 2 === 0 ? '#F9FAFB' : '#FFFFFF'
    row.forEach((cell, ci) => {
      doc.rect(startX + ci * colWidth, y, colWidth, 16).fill(bgColor)
      doc.fill('#000000').text(String(cell ?? ''), startX + ci * colWidth + 4, y + 4, { width: colWidth - 8, ellipsis: true })
    })
    y += 16
  })

  doc.end()
}

// ===================== USER MANAGEMENT REPORT =====================
router.get('/users', async (req, res) => {
  try {
    const { format = 'excel', period } = req.query
    const dateFilter = getDateFilter(period)
    const scope = scopeToAdmin(req)
    const query = { ...scope, ...(dateFilter ? { createdAt: dateFilter } : {}) }

    const users = await User.find(query)
      .select('firstName email phone walletBalance isBlocked isBanned kycApproved isIB ibStatus createdAt')
      .sort({ createdAt: -1 })
      .lean()

    const headers = ['Name', 'Email', 'Phone', 'Wallet Balance', 'Status', 'KYC', 'IB Status', 'Joined']
    const mapRow = (u) => [
      u.firstName || '-',
      u.email,
      u.phone || '-',
      `$${(u.walletBalance || 0).toFixed(2)}`,
      u.isBanned ? 'Banned' : u.isBlocked ? 'Blocked' : 'Active',
      u.kycApproved ? 'Approved' : 'Pending',
      u.isIB ? (u.ibStatus || 'N/A') : 'No',
      u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'
    ]

    const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'Last 7 Days' : 'All Time'

    if (format === 'pdf') {
      return buildPDF(res, `User Management Report (${periodLabel})`, headers, users.map(mapRow), `users_report_${period || 'all'}.pdf`)
    }

    // Excel
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Users')
    sheet.columns = [
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Wallet Balance', key: 'balance', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'KYC', key: 'kyc', width: 12 },
      { header: 'IB Status', key: 'ibStatus', width: 12 },
      { header: 'Joined', key: 'joined', width: 14 }
    ]
    styleHeader(sheet)
    users.forEach(u => {
      const row = mapRow(u)
      sheet.addRow({ name: row[0], email: row[1], phone: row[2], balance: row[3], status: row[4], kyc: row[5], ibStatus: row[6], joined: row[7] })
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="users_report_${period || 'all'}.xlsx"`)
    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error('User report error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===================== FUND MANAGEMENT REPORT =====================
router.get('/funds', async (req, res) => {
  try {
    const { format = 'excel', period } = req.query
    const dateFilter = getDateFilter(period)
    const userIds = await getScopedUserIds(req)
    const query = {
      ...(dateFilter ? { createdAt: dateFilter } : {}),
      ...(userIds !== null ? { userId: { $in: userIds } } : {})
    }

    const transactions = await Transaction.find(query)
      .populate('userId', 'firstName email')
      .select('transactionRef userId type amount bonusAmount totalAmount paymentMethod status createdAt adminRemarks')
      .sort({ createdAt: -1 })
      .lean()

    const headers = ['Txn Ref', 'User', 'Email', 'Type', 'Amount', 'Bonus', 'Total', 'Method', 'Status', 'Date']
    const mapRow = (t) => [
      t.transactionRef || t._id.toString().slice(-8),
      t.userId?.firstName || '-',
      t.userId?.email || '-',
      t.type,
      `$${(t.amount || 0).toFixed(2)}`,
      `$${(t.bonusAmount || 0).toFixed(2)}`,
      `$${(t.totalAmount || t.amount || 0).toFixed(2)}`,
      t.paymentMethod || '-',
      t.status,
      t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'
    ]

    const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'Last 7 Days' : 'All Time'

    if (format === 'pdf') {
      return buildPDF(res, `Fund Management Report (${periodLabel})`, headers, transactions.map(mapRow), `funds_report_${period || 'all'}.pdf`)
    }

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Funds')
    sheet.columns = [
      { header: 'Txn Ref', key: 'ref', width: 14 },
      { header: 'User', key: 'user', width: 18 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Type', key: 'type', width: 18 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Bonus', key: 'bonus', width: 12 },
      { header: 'Total', key: 'total', width: 14 },
      { header: 'Method', key: 'method', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Date', key: 'date', width: 14 }
    ]
    styleHeader(sheet)
    transactions.forEach(t => {
      const row = mapRow(t)
      sheet.addRow({ ref: row[0], user: row[1], email: row[2], type: row[3], amount: row[4], bonus: row[5], total: row[6], method: row[7], status: row[8], date: row[9] })
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="funds_report_${period || 'all'}.xlsx"`)
    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error('Fund report error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===================== IB MANAGEMENT REPORT =====================
router.get('/ib', async (req, res) => {
  try {
    const { format = 'excel', period } = req.query
    const dateFilter = getDateFilter(period)
    const query = { isIB: true }
    if (dateFilter) query.createdAt = dateFilter

    const ibs = await User.find(query)
      .populate('ibPlanId', 'name')
      .select('firstName lastName email referralCode ibLevel ibStatus ibPlanId createdAt')
      .sort({ createdAt: -1 })
      .lean()

    const headers = ['Name', 'Email', 'Referral Code', 'Plan', 'Level', 'Status', 'Joined']
    const mapRow = (ib) => [
      [ib.firstName, ib.lastName].filter(Boolean).join(' ') || '-',
      ib.email,
      ib.referralCode || '-',
      ib.ibPlanId?.name || 'Default',
      ib.ibLevel ?? 0,
      ib.ibStatus || '-',
      ib.createdAt ? new Date(ib.createdAt).toLocaleDateString() : '-'
    ]

    const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'Last 7 Days' : 'All Time'

    if (format === 'pdf') {
      return buildPDF(res, `IB Management Report (${periodLabel})`, headers, ibs.map(mapRow), `ib_report_${period || 'all'}.pdf`)
    }

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('IB Partners')
    sheet.columns = [
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Referral Code', key: 'code', width: 16 },
      { header: 'Plan', key: 'plan', width: 16 },
      { header: 'Level', key: 'level', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Joined', key: 'joined', width: 14 }
    ]
    styleHeader(sheet)
    ibs.forEach(ib => {
      const row = mapRow(ib)
      sheet.addRow({ name: row[0], email: row[1], code: row[2], plan: row[3], level: row[4], status: row[5], joined: row[6] })
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="ib_report_${period || 'all'}.xlsx"`)
    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error('IB report error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===================== ADMIN MANAGEMENT REPORT (SUPER ADMIN ONLY) =====================
router.get('/admins', async (req, res) => {
  try {
    if (!req.admin || req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Super admin access required' })
    }
    const { format = 'excel', period } = req.query
    const dateFilter = getDateFilter(period)
    const query = dateFilter ? { createdAt: dateFilter } : {}

    const admins = await Admin.find(query)
      .select('firstName lastName email role urlSlug brandName status walletBalance permissions createdAt lastLogin')
      .sort({ createdAt: -1 })
      .lean()

    // Count users per admin
    const adminIds = admins.map(a => a._id)
    const userCounts = await User.aggregate([
      { $match: { assignedAdmin: { $in: adminIds } } },
      { $group: { _id: '$assignedAdmin', count: { $sum: 1 } } }
    ])
    const countMap = {}
    userCounts.forEach(uc => { countMap[uc._id.toString()] = uc.count })

    const headers = ['Name', 'Email', 'Role', 'URL Slug', 'Brand', 'Users', 'Wallet Balance', 'Status', 'Last Login', 'Created']
    const mapRow = (a) => {
      const permCount = a.permissions ? Object.values(a.permissions).filter(Boolean).length : 0
      return [
        [a.firstName, a.lastName].filter(Boolean).join(' ') || '-',
        a.email,
        a.role,
        a.urlSlug || '-',
        a.brandName || '-',
        countMap[a._id.toString()] || 0,
        `$${(a.walletBalance || 0).toFixed(2)}`,
        a.status || 'ACTIVE',
        a.lastLogin ? new Date(a.lastLogin).toLocaleDateString() : 'Never',
        a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '-'
      ]
    }

    const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'Last 7 Days' : 'All Time'

    if (format === 'pdf') {
      return buildPDF(res, `Admin Management Report (${periodLabel})`, headers, admins.map(mapRow), `admins_report_${period || 'all'}.pdf`)
    }

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Admins')
    sheet.columns = [
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Role', key: 'role', width: 14 },
      { header: 'URL Slug', key: 'slug', width: 16 },
      { header: 'Brand', key: 'brand', width: 16 },
      { header: 'Users', key: 'users', width: 10 },
      { header: 'Wallet Balance', key: 'balance', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Last Login', key: 'lastLogin', width: 14 },
      { header: 'Created', key: 'created', width: 14 }
    ]
    styleHeader(sheet)
    admins.forEach(a => {
      const row = mapRow(a)
      sheet.addRow({ name: row[0], email: row[1], role: row[2], slug: row[3], brand: row[4], users: row[5], balance: row[6], status: row[7], lastLogin: row[8], created: row[9] })
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="admins_report_${period || 'all'}.xlsx"`)
    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error('Admin report error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===================== EARNINGS REPORT =====================
router.get('/earnings', async (req, res) => {
  try {
    const { format = 'excel', period, view = 'daily' } = req.query
    const dateFilter = getDateFilter(period)
    const matchStage = { status: { $in: ['OPEN', 'CLOSED'] } }
    if (dateFilter) matchStage.openedAt = dateFilter

    const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'Last 7 Days' : 'All Time'

    if (view === 'users') {
      // By User breakdown
      const userEarnings = await Trade.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$userId',
            commission: { $sum: '$commission' },
            spread: { $sum: '$spread' },
            swap: { $sum: '$swap' },
            trades: { $sum: 1 },
            volume: { $sum: '$quantity' }
          }
        },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $sort: { commission: -1 } }
      ])

      const headers = ['User', 'Email', 'Commission', 'Swap', 'Total', 'Trades', 'Volume']
      const mapRow = (e) => [
        e.user?.firstName || e.user?.name || 'Unknown',
        e.user?.email || '-',
        `$${(e.commission || 0).toFixed(2)}`,
        `$${(e.swap || 0).toFixed(2)}`,
        `$${((e.commission || 0) + (e.swap || 0)).toFixed(2)}`,
        e.trades,
        (e.volume || 0).toFixed(2)
      ]

      if (format === 'pdf') {
        return buildPDF(res, `Earnings by User (${periodLabel})`, headers, userEarnings.map(mapRow), `earnings_users_${period || 'all'}.pdf`)
      }

      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Earnings by User')
      sheet.columns = [
        { header: 'User', key: 'user', width: 20 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Commission', key: 'commission', width: 16 },
        { header: 'Swap', key: 'swap', width: 14 },
        { header: 'Total', key: 'total', width: 16 },
        { header: 'Trades', key: 'trades', width: 10 },
        { header: 'Volume', key: 'volume', width: 14 }
      ]
      styleHeader(sheet)
      userEarnings.forEach(e => {
        const row = mapRow(e)
        sheet.addRow({ user: row[0], email: row[1], commission: row[2], swap: row[3], total: row[4], trades: row[5], volume: row[6] })
      })

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="earnings_users_${period || 'all'}.xlsx"`)
      await workbook.xlsx.write(res)
      return res.end()
    }

    if (view === 'symbols') {
      // By Symbol breakdown
      const symbolEarnings = await Trade.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$symbol',
            commission: { $sum: '$commission' },
            spread: { $sum: '$spread' },
            swap: { $sum: '$swap' },
            trades: { $sum: 1 },
            volume: { $sum: '$quantity' }
          }
        },
        { $sort: { commission: -1 } }
      ])

      const headers = ['Symbol', 'Commission', 'Swap', 'Total', 'Trades', 'Volume']
      const mapRow = (e) => [
        e._id,
        `$${(e.commission || 0).toFixed(2)}`,
        `$${(e.swap || 0).toFixed(2)}`,
        `$${((e.commission || 0) + (e.swap || 0)).toFixed(2)}`,
        e.trades,
        (e.volume || 0).toFixed(2)
      ]

      if (format === 'pdf') {
        return buildPDF(res, `Earnings by Symbol (${periodLabel})`, headers, symbolEarnings.map(mapRow), `earnings_symbols_${period || 'all'}.pdf`)
      }

      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Earnings by Symbol')
      sheet.columns = [
        { header: 'Symbol', key: 'symbol', width: 18 },
        { header: 'Commission', key: 'commission', width: 16 },
        { header: 'Swap', key: 'swap', width: 14 },
        { header: 'Total', key: 'total', width: 16 },
        { header: 'Trades', key: 'trades', width: 10 },
        { header: 'Volume', key: 'volume', width: 14 }
      ]
      styleHeader(sheet)
      symbolEarnings.forEach(e => {
        const row = mapRow(e)
        sheet.addRow({ symbol: row[0], commission: row[1], swap: row[2], total: row[3], trades: row[4], volume: row[5] })
      })

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="earnings_symbols_${period || 'all'}.xlsx"`)
      await workbook.xlsx.write(res)
      return res.end()
    }

    // Default: Daily breakdown
    const dailyEarnings = await Trade.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$openedAt' },
            month: { $month: '$openedAt' },
            day: { $dayOfMonth: '$openedAt' }
          },
          commission: { $sum: '$commission' },
          spread: { $sum: '$spread' },
          swap: { $sum: '$swap' },
          trades: { $sum: 1 },
          volume: { $sum: '$quantity' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } }
    ])

    const headers = ['Date', 'Commission', 'Swap', 'Total', 'Trades', 'Volume']
    const mapRow = (e) => [
      `${e._id.year}-${String(e._id.month).padStart(2, '0')}-${String(e._id.day).padStart(2, '0')}`,
      `$${(e.commission || 0).toFixed(2)}`,
      `$${(e.swap || 0).toFixed(2)}`,
      `$${((e.commission || 0) + (e.swap || 0)).toFixed(2)}`,
      e.trades,
      (e.volume || 0).toFixed(2)
    ]

    if (format === 'pdf') {
      return buildPDF(res, `Daily Earnings Report (${periodLabel})`, headers, dailyEarnings.map(mapRow), `earnings_daily_${period || 'all'}.pdf`)
    }

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Daily Earnings')
    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Commission', key: 'commission', width: 16 },
      { header: 'Swap', key: 'swap', width: 14 },
      { header: 'Total', key: 'total', width: 16 },
      { header: 'Trades', key: 'trades', width: 10 },
      { header: 'Volume', key: 'volume', width: 14 }
    ]
    styleHeader(sheet)
    dailyEarnings.forEach(e => {
      const row = mapRow(e)
      sheet.addRow({ date: row[0], commission: row[1], swap: row[2], total: row[3], trades: row[4], volume: row[5] })
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="earnings_daily_${period || 'all'}.xlsx"`)
    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error('Earnings report error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== PROP FIRM PARTICIPANTS REPORT ====================
router.get('/prop-participants', async (req, res) => {
  try {
    const { format = 'excel', period } = req.query
    const dateFilter = getDateFilter(period)

    let query = {}
    if (dateFilter) query.createdAt = dateFilter

    const accounts = await ChallengeAccount.find(query)
      .populate('userId', 'firstName email')
      .populate('challengeId', 'name fundSize stepsCount')
      .sort({ createdAt: -1 })

    const headers = ['User', 'Email', 'Challenge', 'Account ID', 'Account Size', 'Balance', 'P&L', 'Status', 'Phase', 'Daily DD%', 'Overall DD%', 'Profit%', 'Trading Days', 'Total Trades', 'Start Date', 'Expires']

    const mapRow = (a) => {
      const pnl = (a.currentBalance || 0) - (a.initialBalance || 0)
      return [
        a.userId?.firstName || 'Unknown',
        a.userId?.email || '-',
        a.challengeId?.name || '-',
        a.accountId || '-',
        `$${(a.initialBalance || 0).toLocaleString()}`,
        `$${(a.currentBalance || 0).toLocaleString()}`,
        `${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString()}`,
        a.status || '-',
        `${a.currentPhase || 1}/${a.totalPhases || 2}`,
        `${(a.currentDailyDrawdownPercent || 0).toFixed(2)}%`,
        `${(a.currentOverallDrawdownPercent || 0).toFixed(2)}%`,
        `${(a.currentProfitPercent || 0).toFixed(2)}%`,
        a.tradingDaysCount || 0,
        a.totalTrades || 0,
        a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '-',
        a.expiresAt ? new Date(a.expiresAt).toLocaleDateString() : '-'
      ]
    }

    if (format === 'pdf') {
      const rows = accounts.map(mapRow)
      return buildPDF(res, 'Prop Firm Participants Report', headers, rows, `prop_participants_${period || 'all'}.pdf`)
    }

    // Excel
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Participants')
    sheet.columns = [
      { header: 'User', key: 'user', width: 18 },
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Challenge', key: 'challenge', width: 20 },
      { header: 'Account ID', key: 'accountId', width: 14 },
      { header: 'Account Size', key: 'accountSize', width: 14 },
      { header: 'Balance', key: 'balance', width: 14 },
      { header: 'P&L', key: 'pnl', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Phase', key: 'phase', width: 10 },
      { header: 'Daily DD%', key: 'dailyDD', width: 12 },
      { header: 'Overall DD%', key: 'overallDD', width: 12 },
      { header: 'Profit%', key: 'profitPct', width: 12 },
      { header: 'Trading Days', key: 'tradingDays', width: 14 },
      { header: 'Total Trades', key: 'totalTrades', width: 14 },
      { header: 'Start Date', key: 'startDate', width: 14 },
      { header: 'Expires', key: 'expires', width: 14 }
    ]
    styleHeader(sheet)
    accounts.forEach(a => {
      const row = mapRow(a)
      sheet.addRow({
        user: row[0], email: row[1], challenge: row[2], accountId: row[3],
        accountSize: row[4], balance: row[5], pnl: row[6], status: row[7],
        phase: row[8], dailyDD: row[9], overallDD: row[10], profitPct: row[11],
        tradingDays: row[12], totalTrades: row[13], startDate: row[14], expires: row[15]
      })
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="prop_participants_${period || 'all'}.xlsx"`)
    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error('Prop participants report error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
