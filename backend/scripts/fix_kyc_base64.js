// Migration script: Convert base64 KYC images in MongoDB to files on disk
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

const kycUploadsDir = path.join(__dirname, '../uploads/kyc')
if (!fs.existsSync(kycUploadsDir)) {
  fs.mkdirSync(kycUploadsDir, { recursive: true })
}

const saveBase64Image = (base64Data, fieldName) => {
  if (!base64Data || !base64Data.startsWith('data:image')) return null
  
  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!matches) return null
  
  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
  const buffer = Buffer.from(matches[2], 'base64')
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
  const filename = `kyc-${fieldName}-${uniqueSuffix}.${ext}`
  const filePath = path.join(kycUploadsDir, filename)
  
  fs.writeFileSync(filePath, buffer)
  console.log(`  Saved ${fieldName}: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`)
  return `/uploads/kyc/${filename}`
}

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to MongoDB')
  
  const kycs = await mongoose.connection.db.collection('kycs').find({}).toArray()
  console.log(`Found ${kycs.length} KYC records`)
  
  let fixed = 0
  for (const kyc of kycs) {
    const updates = {}
    
    if (kyc.frontImage && kyc.frontImage.startsWith('data:image')) {
      const filePath = saveBase64Image(kyc.frontImage, 'frontImage')
      if (filePath) updates.frontImage = filePath
    }
    if (kyc.backImage && kyc.backImage.startsWith('data:image')) {
      const filePath = saveBase64Image(kyc.backImage, 'backImage')
      if (filePath) updates.backImage = filePath
    }
    if (kyc.selfieImage && kyc.selfieImage.startsWith('data:image')) {
      const filePath = saveBase64Image(kyc.selfieImage, 'selfieImage')
      if (filePath) updates.selfieImage = filePath
    }
    
    if (Object.keys(updates).length > 0) {
      await mongoose.connection.db.collection('kycs').updateOne(
        { _id: kyc._id },
        { $set: updates }
      )
      console.log(`Fixed KYC ${kyc._id} (${Object.keys(updates).join(', ')})`)
      fixed++
    }
  }
  
  console.log(`\nDone! Fixed ${fixed} out of ${kycs.length} records`)
  process.exit(0)
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
