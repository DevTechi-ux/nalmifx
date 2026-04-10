import mongoose from 'mongoose'

const paymentMethodSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Bank Transfer', 'UPI', 'QR Code', 'Cash', 'USDT'],
    required: true
  },
  // Bank Transfer fields
  bankName: {
    type: String
  },
  accountNumber: {
    type: String
  },
  accountHolderName: {
    type: String
  },
  ifscCode: {
    type: String
  },
  // UPI fields
  upiId: {
    type: String
  },
  // QR Code fields
  qrCodeImage: {
    type: String
  },
  // Cash fields
  cashPickupLocation: {
    type: String
  },
  cashDropLocation: {
    type: String
  },
  cashInstructions: {
    type: String
  },
  // USDT fields
  usdtWalletAddress: {
    type: String
  },
  usdtWalletQr: {
    type: String
  },
  usdtNetwork: {
    type: String,
    enum: ['TRC20', 'ERC20', 'BEP20', ''],
    default: ''
  },
  // Common fields
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true })

export default mongoose.model('PaymentMethod', paymentMethodSchema)
