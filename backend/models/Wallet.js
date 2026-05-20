import mongoose from 'mongoose'

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Wallet balance cannot be negative']
  },
  pendingDeposits: {
    type: Number,
    default: 0,
    min: [0, 'pendingDeposits cannot be negative']
  },
  pendingWithdrawals: {
    type: Number,
    default: 0,
    min: [0, 'pendingWithdrawals cannot be negative']
  }
}, { timestamps: true })

// Belt-and-suspenders: refuse to persist a negative balance via .save()
// (Mongoose `min` already handles this, but a pre-save check returns a
// clearer error if someone bypasses it.)
walletSchema.pre('save', function (next) {
  if (this.balance < 0) {
    return next(new Error(`Refusing to save Wallet ${this._id} with negative balance ${this.balance}`))
  }
  next()
})

export default mongoose.model('Wallet', walletSchema)
