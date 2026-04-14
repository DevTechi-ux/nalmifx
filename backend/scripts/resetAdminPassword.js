/**
 * Reset an admin user's password (uses backend/.env MONGODB_URI).
 *
 * Usage (from backend/):
 *   node scripts/resetAdminPassword.js <email> "<newPassword>"
 *
 * Example:
 *   node scripts/resetAdminPassword.js admin@nalmifx.com "Admin@123"
 */
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import Admin from '../models/Admin.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

const emailArg = process.argv[2]
const passwordArg = process.argv[3]

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is missing in .env')
    process.exit(1)
  }
  if (!emailArg || !passwordArg) {
    console.error('Usage: node scripts/resetAdminPassword.js <email> "<newPassword>"')
    process.exit(1)
  }

  const email = emailArg.trim().toLowerCase()
  await mongoose.connect(process.env.MONGODB_URI)
  const admin = await Admin.findOne({ email })
  if (!admin) {
    console.error(`No admin found with email: ${email}`)
    console.error('Create one first: node scripts/seed_superadmin.js')
    process.exit(1)
  }

  admin.password = await bcrypt.hash(passwordArg, 10)
  admin.status = 'ACTIVE'
  await admin.save()
  console.log(`Password updated for ${email} (role: ${admin.role})`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
