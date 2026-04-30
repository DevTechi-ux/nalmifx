import express from 'express'
import SupportTicket from '../models/SupportTicket.js'
import User from '../models/User.js'
import { getScopedUserIds } from '../middleware/auth.js'
import { generateAutoReply, SUPPORT_BOT_NAME } from '../services/supportBot.js'

const router = express.Router()

// Append a bot auto-reply to a ticket. Best-effort: failures are swallowed
// so a bot hiccup never breaks the user-facing create/reply flow.
async function appendBotReply(ticket, { subject, message }) {
  try {
    const reply = generateAutoReply({
      message,
      subject: subject || ticket.subject,
      priority: ticket.priority,
      category: ticket.category,
    })
    if (!reply) return
    ticket.messages.push({
      sender: 'ADMIN',
      senderId: ticket.userId,
      senderName: reply.botName || SUPPORT_BOT_NAME,
      message: reply.message,
      isBot: true,
    })
    // Bot is actively handling the ticket — keep it IN_PROGRESS so the user
    // sees a live conversation (and the unread badge fires) instead of the
    // ticket bouncing into WAITING_USER as if a human had replied.
    if (ticket.status === 'OPEN' || ticket.status === 'WAITING_USER') {
      ticket.status = 'IN_PROGRESS'
    }
    await ticket.save()
  } catch (e) {
    console.error('Support bot auto-reply failed:', e.message)
  }
}

// Assert a ticket's userId is within the calling admin's scope
async function assertTicketUserInScope(req, res, userId) {
  if (req.admin && req.admin.role === 'SUPER_ADMIN') return true
  const ids = await getScopedUserIds(req)
  const allowed = (ids || []).some(id => id.toString() === userId.toString())
  if (!allowed) {
    res.status(403).json({ success: false, message: 'Access denied: ticket not in your branch' })
    return false
  }
  return true
}

// POST /api/support/create - Create new support ticket
router.post('/create', async (req, res) => {
  try {
    const { userId, subject, category, priority, message } = req.body

    if (!userId || !subject || !message) {
      return res.status(400).json({ success: false, message: 'User ID, subject, and message are required' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const ticket = await SupportTicket.create({
      userId,
      subject,
      category: category || 'GENERAL',
      priority: priority || 'MEDIUM',
      messages: [{
        sender: 'USER',
        senderId: userId,
        senderName: user.firstName,
        message
      }]
    })

    // Auto-reply: triage the ticket immediately based on priority + category
    await appendBotReply(ticket, { subject, message })

    res.json({
      success: true,
      message: 'Support ticket created successfully',
      ticket
    })
  } catch (error) {
    console.error('Error creating support ticket:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Count unread messages on a ticket from the user's POV — every non-USER
// message created after userLastReadAt is unread.
function countUnread(ticket) {
  const cutoff = ticket.userLastReadAt ? new Date(ticket.userLastReadAt).getTime() : 0
  let n = 0
  for (const m of ticket.messages || []) {
    if (m.sender !== 'USER' && new Date(m.createdAt).getTime() > cutoff) n++
  }
  return n
}

// GET /api/support/user/:userId - Get user's tickets
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { status } = req.query

    const query = { userId }
    if (status) query.status = status

    const docs = await SupportTicket.find(query)
      .sort({ createdAt: -1 })
      .populate('assignedTo', 'firstName email')

    const tickets = docs.map(d => {
      const obj = d.toObject()
      obj.unreadCount = countUnread(d)
      return obj
    })

    res.json({ success: true, tickets })
  } catch (error) {
    console.error('Error fetching user tickets:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/support/user/:userId/unread - Total unread admin/bot replies
// across the user's open tickets. Drives the sidebar notification badge.
router.get('/user/:userId/unread', async (req, res) => {
  try {
    const { userId } = req.params
    const tickets = await SupportTicket.find({
      userId,
      status: { $nin: ['CLOSED'] },
    }).select('messages userLastReadAt')

    let total = 0
    let ticketsWithUnread = 0
    for (const t of tickets) {
      const n = countUnread(t)
      if (n > 0) {
        total += n
        ticketsWithUnread++
      }
    }
    res.json({ success: true, count: total, tickets: ticketsWithUnread })
  } catch (error) {
    console.error('Error fetching unread count:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/support/user/:userId/mark-read/:ticketId - Mark all current
// admin/bot messages as read by the user. Called when the user opens a ticket.
router.post('/user/:userId/mark-read/:ticketId', async (req, res) => {
  try {
    const { userId, ticketId } = req.params
    const ticket = await SupportTicket.findOne({ ticketId })
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' })
    }
    if (ticket.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Not your ticket' })
    }
    ticket.userLastReadAt = new Date()
    await ticket.save()
    res.json({ success: true })
  } catch (error) {
    console.error('Error marking ticket read:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/support/ticket/:ticketId - Get single ticket with messages
router.get('/ticket/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params

    const ticket = await SupportTicket.findOne({ ticketId })
      .populate('userId', 'firstName email')
      .populate('assignedTo', 'firstName email')

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' })
    }

    res.json({ success: true, ticket })
  } catch (error) {
    console.error('Error fetching ticket:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/support/reply/:ticketId - Add reply to ticket
router.post('/reply/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params
    const { senderId, senderType, senderName, message } = req.body

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' })
    }

    const ticket = await SupportTicket.findOne({ ticketId })
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' })
    }

    let finalSenderName = senderName || 'Support'
    let finalSenderId = senderId

    // For user replies, validate the user exists
    if (senderType !== 'ADMIN') {
      if (!senderId) {
        return res.status(400).json({ success: false, message: 'Sender ID is required for user replies' })
      }
      const user = await User.findById(senderId)
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' })
      }
      finalSenderName = user.firstName || 'User'
      finalSenderId = senderId
    } else {
      // For admin replies, use provided name or default
      finalSenderName = senderName || 'Support Team'
      finalSenderId = senderId || ticket.userId // Use ticket user ID as fallback for reference
    }

    ticket.messages.push({
      sender: senderType || 'USER',
      senderId: finalSenderId,
      senderName: finalSenderName,
      message
    })

    // Update status based on who replied
    if (senderType === 'ADMIN') {
      ticket.status = 'WAITING_USER'
    } else {
      if (ticket.status === 'WAITING_USER' || ticket.status === 'RESOLVED') {
        ticket.status = 'IN_PROGRESS'
      }
    }

    await ticket.save()

    // If a user replied and no human admin has taken the ticket yet, the bot
    // can offer another targeted answer. We skip when assignedTo is set so the
    // bot doesn't talk over a human handler.
    if (senderType !== 'ADMIN' && !ticket.assignedTo && ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED') {
      await appendBotReply(ticket, { subject: ticket.subject, message })
    }

    // Re-fetch with populated fields
    const updatedTicket = await SupportTicket.findOne({ ticketId })
      .populate('userId', 'firstName lastName email')

    res.json({
      success: true,
      message: 'Reply added successfully',
      ticket: updatedTicket
    })
  } catch (error) {
    console.error('Error adding reply:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== ADMIN ROUTES ====================

// GET /api/support/admin/all - Get all tickets (admin, scoped)
router.get('/admin/all', async (req, res) => {
  try {
    const { status, priority, category, limit = 50, offset = 0 } = req.query

    const query = {}
    if (status) query.status = status
    if (priority) query.priority = priority
    if (category) query.category = category

    // Scope to sub-admin's users
    const userIds = await getScopedUserIds(req)
    if (userIds !== null) {
      query.userId = { $in: userIds }
    }

    const tickets = await SupportTicket.find(query)
      .populate('userId', 'firstName email')
      .populate('assignedTo', 'firstName email')
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))

    const total = await SupportTicket.countDocuments(query)

    res.json({ success: true, tickets, total })
  } catch (error) {
    console.error('Error fetching all tickets:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/support/admin/stats - Get ticket stats (scoped)
router.get('/admin/stats', async (req, res) => {
  try {
    const userIds = await getScopedUserIds(req)
    const scope = userIds !== null ? { userId: { $in: userIds } } : {}

    const [total, open, inProgress, resolved, closed] = await Promise.all([
      SupportTicket.countDocuments(scope),
      SupportTicket.countDocuments({ ...scope, status: 'OPEN' }),
      SupportTicket.countDocuments({ ...scope, status: 'IN_PROGRESS' }),
      SupportTicket.countDocuments({ ...scope, status: 'RESOLVED' }),
      SupportTicket.countDocuments({ ...scope, status: 'CLOSED' })
    ])

    res.json({ success: true, stats: { total, open, inProgress, resolved, closed } })
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/support/admin/status/:ticketId - Update ticket status
router.put('/admin/status/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params
    const { status } = req.body

    const ticket = await SupportTicket.findOne({ ticketId })
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' })
    }

    if (!(await assertTicketUserInScope(req, res, ticket.userId))) return

    ticket.status = status
    if (status === 'RESOLVED') {
      ticket.resolvedAt = new Date()
    } else if (status === 'CLOSED') {
      ticket.closedAt = new Date()
    }

    await ticket.save()

    res.json({
      success: true,
      message: 'Ticket status updated',
      ticket
    })
  } catch (error) {
    console.error('Error updating ticket status:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/support/admin/assign/:ticketId - Assign ticket to admin
router.put('/admin/assign/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params
    const { adminId } = req.body

    const ticket = await SupportTicket.findOne({ ticketId })
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' })
    }

    if (!(await assertTicketUserInScope(req, res, ticket.userId))) return

    ticket.assignedTo = adminId
    if (ticket.status === 'OPEN') {
      ticket.status = 'IN_PROGRESS'
    }

    await ticket.save()

    res.json({
      success: true,
      message: 'Ticket assigned successfully',
      ticket
    })
  } catch (error) {
    console.error('Error assigning ticket:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/support/admin/priority/:ticketId - Update ticket priority
router.put('/admin/priority/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params
    const { priority } = req.body

    const existing = await SupportTicket.findOne({ ticketId })
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Ticket not found' })
    }
    if (!(await assertTicketUserInScope(req, res, existing.userId))) return

    existing.priority = priority
    await existing.save()

    res.json({
      success: true,
      message: 'Priority updated',
      ticket: existing
    })
  } catch (error) {
    console.error('Error updating priority:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
