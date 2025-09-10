const userProfileIsActive = (profile) => {
  const now = new Date()

  if (profile.FromDate) {
    const from = new Date(profile.FromDate)
    if (isNaN(from.getTime())) {
      return false // Invalid date, consider not active
    }
    if (from > now) {
      return false // Not active yet
    }
  }
  if (profile.ToDate) {
    const to = new Date(profile.ToDate)
    if (isNaN(to.getTime())) {
      return false // Invalid date, consider not active
    }
    if (to < now) {
      return false // Expired
    }
  }
  return true // No from/to date or valid range
}

module.exports = { userProfileIsActive }