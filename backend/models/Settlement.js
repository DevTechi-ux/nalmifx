import mongoose from 'mongoose'

const settlementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  contact: {
    type: String,
    required: true,
    trim: true
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  source: {
    type: String,
    enum: ['fund_management', 'ib_management', 'earnings'],
    required: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  adminName: {
    type: String,
    default: ''
  }
}, { timestamps: true })

settlementSchema.index({ source: 1, createdAt: -1 })

export default mongoose.model('Settlement', settlementSchema)
