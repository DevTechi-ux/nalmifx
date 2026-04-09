// Script: Create a user account with a trading account
// Usage: node scripts/create_user.js
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

// =================== CONFIGURE USER HERE ===================
const USER = {
  firstName: 'John Doe',
  email: 'johndoe@example.com',
  password: 'Password@123',
  phone: '1234567890',
  countryCode: '+1',

  // Trading account settings
  initialBalance: 10000,      // Initial wallet & trading account balance
  leverage: '1:100',          // Leverage (must match an AccountType in DB)
}
// ===========================================================

async function createUser() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to MongoDB')

  const db = mongoose.connection.db

  // Check if user already exists
  const existing = await db.collection('users').findOne({ email: USER.email.toLowerCase() })
  if (existing) {
    console.log(`\n⚠️  User already exists: ${existing.email}`)
    process.exit(0)
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(USER.password, 12)

  // Insert user
  const userResult = await db.collection('users').insertOne({
    firstName: USER.firstName,
    email: USER.email.toLowerCase(),
    password: hashedPassword,
    phone: USER.phone,
    countryCode: USER.countryCode,
    walletBalance: USER.initialBalance,
    isBlocked: false,
    isBanned: false,
    blockReason: '',
    banReason: '',
    isIB: false,
    ibStatus: null,
    ibPlanId: null,
    referralCode: null,
    parentIBId: null,
    ibLevel: 0,
    ibLevelId: null,
    ibLevelOrder: 1,
    autoUpgradeEnabled: true,
    referredBy: null,
    assignedAdmin: null,
    adminUrlSlug: null,
    bankDetails: { bankName: '', accountNumber: '', accountHolderName: '', ifscCode: '', branchName: '' },
    upiId: '',
    profileImage: null,
    kycApproved: false,
    createdAt: new Date(),
    passwordChangedAt: null
  })

  const userId = userResult.insertedId
  console.log(`\n✅ User created: ${USER.email} (ID: ${userId})`)

  // Create wallet for user
  await db.collection('wallets').insertOne({
    userId,
    balance: USER.initialBalance,
    createdAt: new Date()
  })
  console.log(`✅ Wallet created with balance: $${USER.initialBalance}`)

  // Find a matching AccountType by leverage
  const accountType = await db.collection('accounttypes').findOne({ leverage: USER.leverage })
  if (!accountType) {
    console.log(`\n⚠️  No AccountType found with leverage "${USER.leverage}". Skipping trading account creation.`)
    console.log('   Available account types:')
    const allTypes = await db.collection('accounttypes').find({}).toArray()
    allTypes.forEach(t => console.log(`   - ${t.name} | Leverage: ${t.leverage}`))
  } else {
    // Generate unique 8-digit account ID
    let accountId
    let exists = true
    while (exists) {
      accountId = `${Math.floor(10000000 + Math.random() * 90000000)}`
      exists = await db.collection('tradingaccounts').findOne({ accountId })
    }

    await db.collection('tradingaccounts').insertOne({
      userId,
      accountTypeId: accountType._id,
      accountId,
      balance: USER.initialBalance,
      credit: 0,
      leverage: USER.leverage,
      exposureLimit: 0,
      status: 'Active',
      frozenReason: '',
      frozenAt: null,
      frozenBy: null,
      isDemo: false,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    console.log(`✅ Trading account created: ${accountId} (${accountType.name} | ${USER.leverage})`)
  }

  console.log('\n================================')
  console.log(`Name:     ${USER.firstName}`)
  console.log(`Email:    ${USER.email}`)
  console.log(`Password: ${USER.password}`)
  console.log(`Balance:  $${USER.initialBalance}`)
  console.log('================================')
  console.log('\nUser can now log in with these credentials.')

  process.exit(0)
}

createUser().catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
