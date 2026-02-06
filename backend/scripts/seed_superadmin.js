// Seed script: Create Super Admin account in database
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

// ========== CONFIGURE SUPER ADMIN CREDENTIALS HERE ==========
const SUPER_ADMIN = {
  email: 'admin@nalmifx.com',
  password: 'Admin@123',
  firstName: 'Super',
  lastName: 'Admin'
}
// =============================================================

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to MongoDB')

  const db = mongoose.connection.db

  // Check if super admin already exists
  const existing = await db.collection('admins').findOne({ role: 'SUPER_ADMIN' })
  if (existing) {
    console.log(`Super admin already exists: ${existing.email}`)
    console.log('To reset, delete the existing super admin first.')
    process.exit(0)
  }

  const hashedPassword = await bcrypt.hash(SUPER_ADMIN.password, 10)

  const superAdmin = {
    email: SUPER_ADMIN.email.toLowerCase(),
    password: hashedPassword,
    firstName: SUPER_ADMIN.firstName,
    lastName: SUPER_ADMIN.lastName,
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    urlSlug: 'super-admin',
    brandName: 'Super Admin',
    permissions: {
      canManageUsers: true,
      canCreateUsers: true,
      canDeleteUsers: true,
      canViewUsers: true,
      canManageTrades: true,
      canCloseTrades: true,
      canModifyTrades: true,
      canManageAccounts: true,
      canCreateAccounts: true,
      canDeleteAccounts: true,
      canModifyLeverage: true,
      canManageDeposits: true,
      canApproveDeposits: true,
      canManageWithdrawals: true,
      canApproveWithdrawals: true,
      canManageKYC: true,
      canApproveKYC: true,
      canManageIB: true,
      canApproveIB: true,
      canManageCopyTrading: true,
      canApproveMasters: true,
      canManageSymbols: true,
      canManageGroups: true,
      canManageSettings: true,
      canManageTheme: true,
      canViewReports: true,
      canExportReports: true,
      canManageAdmins: true,
      canFundAdmins: true
    },
    createdAt: new Date(),
    lastLogin: null
  }

  const result = await db.collection('admins').insertOne(superAdmin)

  // Create wallet for super admin
  await db.collection('adminwallets').insertOne({
    adminId: result.insertedId,
    balance: 999999999,
    createdAt: new Date()
  })

  console.log('\n✅ Super Admin created successfully!')
  console.log('================================')
  console.log(`Email:    ${SUPER_ADMIN.email}`)
  console.log(`Password: ${SUPER_ADMIN.password}`)
  console.log(`Role:     SUPER_ADMIN`)
  console.log('================================')
  console.log('\nYou can now login with these credentials.')

  process.exit(0)
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
