import Admin from '../models/Admin.js'
import User from '../models/User.js'
import Transaction from '../models/Transaction.js'

// Allocate a fresh 5-digit branch code that isn't already in use. Starts at
// 10000 to guarantee 5 digits and walks up — branches are few, so a linear
// scan is fine and avoids any collision-retry loop with random codes.
export async function allocateBranchCode() {
  const taken = new Set(
    (await Admin.find({ branchCode: { $ne: null } }).select('branchCode').lean())
      .map(a => a.branchCode)
      .filter(Boolean)
  )
  for (let n = 10000; n <= 99999; n++) {
    const s = String(n)
    if (!taken.has(s)) return s
  }
  throw new Error('No available branch codes (99999 exhausted)')
}

// Backfill: assign branchCodes to existing admins that don't have one, and
// stamp their users' branchCode field. Idempotent. Returns counts of touched
// admins/users for the API response.
export async function backfillBranchCodes() {
  const admins = await Admin.find({ branchCode: null })
  let adminsUpdated = 0
  let usersUpdated = 0
  for (const admin of admins) {
    admin.branchCode = await allocateBranchCode()
    await admin.save()
    adminsUpdated++
    const r = await User.updateMany(
      { assignedAdmin: admin._id, branchCode: null },
      { $set: { branchCode: admin.branchCode } }
    )
    usersUpdated += r.modifiedCount || 0
  }
  // Sweep users whose admin already has a code but their own field is missing
  const adminsWithCode = await Admin.find({ branchCode: { $ne: null } }).select('_id branchCode').lean()
  for (const a of adminsWithCode) {
    const r = await User.updateMany(
      { assignedAdmin: a._id, $or: [{ branchCode: null }, { branchCode: { $exists: false } }] },
      { $set: { branchCode: a.branchCode } }
    )
    usersUpdated += r.modifiedCount || 0
  }
  return { adminsUpdated, usersUpdated }
}

// Move users (`all` or specific ids) from fromAdminId to toAdminId. Re-stamps
// branchCode and re-scopes pending withdrawal/deposit transactions so the
// receiving branch admin can approve them.
export async function transferUsers({ fromAdminId, toAdminId, userIds, all = false }) {
  if (String(fromAdminId) === String(toAdminId)) {
    throw new Error('Source and destination branch are the same')
  }
  const toAdmin = await Admin.findById(toAdminId)
  if (!toAdmin) throw new Error('Destination branch not found')
  if (!toAdmin.branchCode) {
    toAdmin.branchCode = await allocateBranchCode()
    await toAdmin.save()
  }

  const filter = { assignedAdmin: fromAdminId }
  if (!all) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('Provide userIds[] or set all=true')
    }
    filter._id = { $in: userIds }
  }

  const targetUsers = await User.find(filter).select('_id').lean()
  const targetIds = targetUsers.map(u => u._id)
  if (targetIds.length === 0) return { transferredUsers: 0, transferredPending: 0 }

  await User.updateMany(
    { _id: { $in: targetIds } },
    { $set: { assignedAdmin: toAdmin._id, branchCode: toAdmin.branchCode, adminUrlSlug: toAdmin.urlSlug } }
  )

  // Re-scope only PENDING transactions; settled history stays where it was
  // so the original branch's books remain intact for auditing.
  const txRes = await Transaction.updateMany(
    { userId: { $in: targetIds }, status: 'Pending' },
    { $set: {} } // no Transaction field needs change today; userId is the scope key.
  )

  return { transferredUsers: targetIds.length, transferredPending: txRes.modifiedCount || 0 }
}

// Assign one or more users to a branch admin regardless of their current
// assignment. Used by the "Add Users" flow in Branch Management — works for
// unassigned users (assignedAdmin: null) and for users already in another
// branch. Users already assigned to this same branch are skipped.
export async function assignUsersToBranch({ toAdminId, userIds }) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new Error('userIds[] is required')
  }
  const toAdmin = await Admin.findById(toAdminId)
  if (!toAdmin) throw new Error('Destination branch not found')
  if (!toAdmin.branchCode) {
    toAdmin.branchCode = await allocateBranchCode()
    await toAdmin.save()
  }

  const candidates = await User.find({ _id: { $in: userIds } }).select('_id assignedAdmin').lean()
  const targetIds = candidates
    .filter(u => String(u.assignedAdmin || '') !== String(toAdmin._id))
    .map(u => u._id)

  if (targetIds.length === 0) {
    return { assigned: 0, skipped: candidates.length, message: 'All selected users are already in this branch' }
  }

  await User.updateMany(
    { _id: { $in: targetIds } },
    { $set: { assignedAdmin: toAdmin._id, branchCode: toAdmin.branchCode, adminUrlSlug: toAdmin.urlSlug } }
  )

  return { assigned: targetIds.length, skipped: candidates.length - targetIds.length }
}
