import express from 'express'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import Settlement from '../models/Settlement.js'
import Transaction from '../models/Transaction.js'
import Trade from '../models/Trade.js'

const router = express.Router()

// GET /api/settlements - List settlements (with optional source filter)
router.get('/', async (req, res) => {
  try {
    const { source, page = 1, limit = 50 } = req.query
    const query = source ? { source } : {}
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [settlements, total] = await Promise.all([
      Settlement.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Settlement.countDocuments(query)
    ])

    res.json({ success: true, settlements, total })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/settlements/summary - Aggregate totals per source
router.get('/summary', async (req, res) => {
  try {
    const [bySource, overall] = await Promise.all([
      Settlement.aggregate([
        { $group: { _id: '$source', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Settlement.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ])
    ])

    const sources = {}
    bySource.forEach(s => { sources[s._id] = { total: s.total, count: s.count } })

    res.json({
      success: true,
      summary: {
        overall: overall[0] || { total: 0, count: 0 },
        fund_management: sources.fund_management || { total: 0, count: 0 },
        ib_management: sources.ib_management || { total: 0, count: 0 },
        earnings: sources.earnings || { total: 0, count: 0 }
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Helper: get max available balance for a source
async function getSourceBalance(source) {
  const settledAgg = await Settlement.aggregate([
    { $match: { source } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ])
  const totalSettled = settledAgg[0]?.total || 0

  if (source === 'fund_management') {
    const deposits = await Transaction.aggregate([
      { $match: { type: { $in: ['Deposit', 'Admin_Credit'] }, status: { $in: ['Approved', 'Completed'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
    const withdrawals = await Transaction.aggregate([
      { $match: { type: { $in: ['Withdrawal', 'Admin_Debit'] }, status: { $in: ['Approved', 'Completed'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
    const net = (deposits[0]?.total || 0) - (withdrawals[0]?.total || 0)
    return net - totalSettled
  }

  if (source === 'ib_management') {
    const ibAgg = await Trade.aggregate([
      { $match: { status: { $in: ['OPEN', 'CLOSED'] } } },
      { $group: { _id: null, total: { $sum: '$commission' } } }
    ])
    return (ibAgg[0]?.total || 0) - totalSettled
  }

  if (source === 'earnings') {
    const earningsAgg = await Trade.aggregate([
      { $match: { status: { $in: ['OPEN', 'CLOSED'] } } },
      { $group: { _id: null, total: { $sum: { $add: ['$commission', '$swap'] } } } }
    ])
    return (earningsAgg[0]?.total || 0) - totalSettled
  }

  return 0
}

// POST /api/settlements - Create a new settlement
router.post('/', async (req, res) => {
  try {
    const { name, amount, contact, reason, source, adminName } = req.body

    if (!name || !amount || !contact || !reason || !source) {
      return res.status(400).json({ success: false, message: 'All fields are required' })
    }

    if (!['fund_management', 'ib_management', 'earnings'].includes(source)) {
      return res.status(400).json({ success: false, message: 'Invalid source' })
    }

    const parsedAmount = parseFloat(amount)
    const available = await getSourceBalance(source)
    if (parsedAmount > available) {
      return res.status(400).json({
        success: false,
        message: `Settlement amount ($${parsedAmount.toFixed(2)}) exceeds available balance ($${available.toFixed(2)})`
      })
    }

    const settlement = await Settlement.create({ name, amount: parsedAmount, contact, reason, source, adminName })
    res.status(201).json({ success: true, settlement })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// DELETE /api/settlements/:id
router.delete('/:id', async (req, res) => {
  try {
    const settlement = await Settlement.findByIdAndDelete(req.params.id)
    if (!settlement) return res.status(404).json({ success: false, message: 'Settlement not found' })
    res.json({ success: true, message: 'Settlement deleted' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/settlements/export - Download as Excel or PDF
router.get('/export', async (req, res) => {
  try {
    const { format = 'excel', source, period } = req.query
    const query = source ? { source } : {}

    // Date filter
    if (period === 'daily') {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      query.createdAt = { $gte: start }
    } else if (period === 'weekly') {
      const start = new Date()
      start.setDate(start.getDate() - 7)
      start.setHours(0, 0, 0, 0)
      query.createdAt = { $gte: start }
    }

    const settlements = await Settlement.find(query).sort({ createdAt: -1 })

    if (format === 'pdf') {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 })
      const filename = `settlements_${source || 'all'}_${period || 'all'}.pdf`
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      doc.pipe(res)

      doc.fontSize(16).font('Helvetica-Bold').text('Settlement Report', { align: 'center' })
      doc.moveDown(0.3)
      doc.fontSize(9).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}${source ? ` | Source: ${source}` : ''}`, { align: 'center' })
      doc.moveDown(0.8)

      const headers = ['#', 'Name', 'Amount', 'Contact', 'Reason', 'Source', 'Date']
      const tableWidth = doc.page.width - 60
      const colWidth = tableWidth / headers.length
      const startX = 30
      let y = doc.y

      doc.font('Helvetica-Bold').fontSize(8)
      headers.forEach((h, i) => {
        doc.rect(startX + i * colWidth, y, colWidth, 18).fill('#1F2937')
        doc.fill('#FFFFFF').text(h, startX + i * colWidth + 4, y + 5, { width: colWidth - 8, ellipsis: true })
      })
      y += 18
      doc.fill('#000000')

      doc.font('Helvetica').fontSize(7)
      settlements.forEach((s, ri) => {
        if (y > doc.page.height - 50) { doc.addPage(); y = 30 }
        const bgColor = ri % 2 === 0 ? '#F9FAFB' : '#FFFFFF'
        const row = [ri + 1, s.name, `$${s.amount.toFixed(2)}`, s.contact, s.reason, s.source, new Date(s.createdAt).toLocaleDateString()]
        row.forEach((cell, ci) => {
          doc.rect(startX + ci * colWidth, y, colWidth, 16).fill(bgColor)
          doc.fill('#000000').text(String(cell), startX + ci * colWidth + 4, y + 4, { width: colWidth - 8, ellipsis: true })
        })
        y += 16
      })

      doc.end()
    } else {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Settlements')
      sheet.columns = [
        { header: '#', key: 'index', width: 6 },
        { header: 'Name', key: 'name', width: 22 },
        { header: 'Amount ($)', key: 'amount', width: 14 },
        { header: 'Contact', key: 'contact', width: 22 },
        { header: 'Reason', key: 'reason', width: 30 },
        { header: 'Source', key: 'source', width: 18 },
        { header: 'Admin', key: 'adminName', width: 16 },
        { header: 'Date', key: 'date', width: 18 }
      ]

      // Style header
      const headerRow = sheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
      headerRow.height = 28

      settlements.forEach((s, i) => {
        sheet.addRow({
          index: i + 1,
          name: s.name,
          amount: s.amount,
          contact: s.contact,
          reason: s.reason,
          source: s.source,
          adminName: s.adminName || '-',
          date: new Date(s.createdAt).toLocaleDateString()
        })
      })

      const filename = `settlements_${source || 'all'}_${period || 'all'}.xlsx`
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      await workbook.xlsx.write(res)
      res.end()
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
