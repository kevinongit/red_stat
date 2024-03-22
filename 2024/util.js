
function getBizDaysBetween(startDate, endDate) {
  const oneDayInMs = 1000 * 60 * 60 * 24

  startDate.setHours(0, 0, 0, 1)
  endDate.setHours(23, 59, 59, 999)

  const diff = endDate - startDate
  let days = Math.floor(diff / oneDayInMs)
  const firstDays = days // for debug purpose

  // subtract two weekend days for every week in between
  const weeks = Math.floor(days / 7)
  days = days - (weeks * 2)

  // handle a case which less than 7 but including weekend
  let startDay = startDate.getDay()
  let endDay = endDate.getDay()
  if (startDay - endDay >= 1) {
    days = days - 2
  }

  // Remove start day if span starts on Sun but ends before Sat
  if (startDay == 0 && endDay != 6) {
    days = days - 1
  }

  // Remove end day if span ends on Sat but starts after Sun
  if (endDay == 6 && startDay != 0) {
    days = days - 1
  }

  return days
}


function timestamp() {
  const today = new Date()
  today.setHours(today.getHours() + 9)

  return today.toISOString().replace('T', ' ').substring(5, 16)
}

module.exports = {
  getBizDaysBetween,
  timestamp,
}
