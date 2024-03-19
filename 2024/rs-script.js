let currentIssueList
let currentRequestList

function categoryButton() {
  let buttonGroup = document.getElementById('button-group1')
  let prevButton = null

  buttonGroup.addEventListener('click', e => {
    if (e.target.nodeName === 'BUTTON') {
      e.target.classList.add('active')
      if (prevButton !== null) {
        prevButton.classList.remove('active')
      }
      prevButton = e.target
    }
  })
}

function filterCategory(category) {
  let filter = ''

  switch (category) {
    case 'sbang':
      filter = '&filter=스타뱅킹'
      break;
    case 'inbang':
      filter = '&filter=인터넷뱅킹'
      break;
    case 'all':
    default:
      break;
  }

  window.location = `http://REDSTAT_IPADDR/redstat?genfile=true&type=TARGET_TYPE${filter}`
}

function getCurrentBrowser(userAgent) {
  // (22/05/17 kevin) below three will suffice for now, add more browser if you want to. default is definitely Chrome.
  // IE - "rv" : Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; .NET CLR 2.0 50727; ... rv:11.0) Gecko
  // Edge - "Edg" : Mozilla/5.0 ... Edg/91.0.864.64
  // Chrome - "Chrome" : Mozilla/5.0 ...Chrome/70.0.3507.0 ...
  const browser = userAgent.indexOf('rv') > -1 || userAgent.indexOf("MSIE") > -1 ? "ie" : ( userAgent.indexOf('Edg') > -1 ? "edge" : "chrome" )
  // console.log({browser, userAgent})

  return browser
}

function getPriorityColor(priority = 'Minor') {
  const color = priority === 'Critical' ? 'red' : (priority === 'Major' ? 'yellow' : 'white')
  return color
}

/// set main TR's static cells rowspan
/// 1) main TR has an id attribute
/// 2) static cells : main TR's TDs [0 ~ (n-2)] -> will stay one row while dynamic cells expand according to the number of issues.
function setTrRowspan(tr, rowspan) {
  if (!tr) return
  const tds = tr.cells
  const staticTdCount = tds.length - 2 // excluding last two columns - status[n-1] and issues[n]
  if (staticTdCount <= 0) return
  for (let i = 0; i < staticTdCount; i++) {
    tds[i].setAttribute('rowspan', `${rowspan}`)
  }
  tds[staticTdCount].innerHTML = `<span class="issue-clear">&#128584;</span>`
  console.log(`setTrRowspan(tr [${tr.rowIndex}]) : ${rowspan}`)
}

function getTrStartIndexAndLength(table, tr = null) {
  console.log('>>> tr', tr)
  if (!tr) {
    /// fallback : all rows(tr)
    return {
      startIndex: 0, /// the start index for first tr
      length: table.rows.length - 1, /// the number of empty tr in range(same group)
    }
  }
  let length = 0
  for (let i = tr.rowIndex + 1; i < table.rows.length; i++) {
    if (table.rows[i].id !== '') break /// non-empty id is the signal of another group
    length++
  }
  return {
    startIndex: tr.rowIndex,
    length,
  }
}

function deleteEmptyTr(table, startIndex, length) {
  /// 1.only empty trs will be deleted
  /// 2.each empty tr should be deleted in reverse order
  for (let i = startIndex + length; i >= startIndex; i--) {
    if (table.rows[i].id === '') {
      console.log(`- row(${i}) deleted`)
      table.deleteRow(i)
    } else {
      /// rowspan should be initialized due to the deleteRow()
      setTrRowspan(table.rows[i], 1)
    }
  }
}

function initTableRow2(prefix, idx = null) {
  const table = document.getElementById(`${prefix}-table`)
  const tr = (idx !== null) ? document.getElementById(`${prefix}_tr_${idx}`) : null

  console.log({ prefix, idx, table })
  const { startIndex, length } = getTrStartIndexAndLength(table, tr)
  console.log({ startIndex, length })
  deleteEmptyTr(table, startIndex, length)
}

function showAllIssue(prefix, keys) {
  const records = prefix === 'small' ? currentRequestList : currentIssueList
  console.log(`records.length=`, { records })
  // initTableRow2(prefix)

  records.map((record, idx) => {
    showIssueWithInit(prefix, idx, keys)
  })
}

function showIssueWithInit(prefix, idx, key) {
  initTableRow2(prefix, idx)
  showIssue(prefix, idx, key)
}

function showIssue(prefix, idx, key) {
  const tableTarget = document.getElementById(`${prefix}-table`)
  // const statusTarget = document.getElementById(`${prefix}_${idx}_status`)

  const tr = document.getElementById(`${prefix}_tr_${idx}`)
  const { startIndex, length: trLength } = getTrStartIndexAndLength(tableTarget, tr)

  if (!key || !key.length) {
    const issuestarget = document.getElementById(`${prefix}_${idx}_issues`)
    issuestarget.innerHTML = `<span class="issue-clear">&#128584;</span>`
    return
  }
  const records = prefix === 'small' ? currentRequestList : currentIssueList
  /// 2024/01/15 flatMap() not supported lower version chrome - e.g. 58. replace it with equivalent map().reduce()
  // const list = Array.isArray(key) ? key.flatMap(k => records[idx][k]) : records[idx][key]
  const list = Array.isArray(key) ? key.map(k => records[idx][k]).reduce((a,b) => a.concat(b), []) : records[idx][key]
  const rowspan = list.length || 1 /// static tds rowspan value determined by dynamic tds

  console.log('*****', { list, startIndex, trLength, rowspan })
  setTrRowspan(tr, rowspan)

  const dynamicRowHtml = list.length ? list.map(({
    num,
    title,
    item,
  }, jdx) => {
    const priorityColor = getPriorityColor(item.priority)
    const strItem = JSON.stringify(item)
    const encoded = btoa(unescape(encodeURIComponent(strItem)))
    // const decoded = decodeURIComponent(escape(atob(encoded)))
    // const item2 = JSON.parse(decoded)

    let cell1, cell2
    if (jdx <= trLength) {
      // cell1 = document.getElementById(`${prefix}_${idx}_status`)
      // cell12= document.getElementById(`${prefix}_${idx}_issues`)

      /// 22.12.09 - calculate the cell1 id by getting cellLen instead of assuming the status idx as 7. (7 part is very static and not a good idea)
      const cellLen = tableTarget.rows[tr.rowIndex + jdx].cells.length - 1
      const cellIdx = (jdx === 0) ? cellLen - 1 : 0
      // cell1 = tr.cells[cellIdx]
      // cell2 = tr.cells[cellIdx+1]
      console.log('+++++', tableTarget.rows[tr.rowIndex + jdx].cells)
      cell1 = tableTarget.rows[tr.rowIndex + jdx].cells[cellIdx]
      cell2 = tableTarget.rows[tr.rowIndex + jdx].cells[cellIdx + 1]
      console.log({ rowIndex: tr.rowIndex, jdx, cellIdx, cell1, cell2 })
    } else {
      console.log(`+ row(${startIndex + jdx}) inserted`, { idx, jdx, startIndex, })
      const row = tableTarget.insertRow(startIndex + jdx)
      cell1 = row.insertCell(0)
      cell2 = row.insertCell(1)

      cell1.setAttribute("style", "text-align: center; word-break: break-all;")
    }

    cell1.innerHTML = `
        ${getStatusCircleHtml(item.dayNum)}
      `

    const divChar = item.channelDivId || item.divisionCharacter  /// FIXME
    const bgStyle = item.interest_work === '예' ? `style="background-color: #ffaa00;"` : ''
    cell2.innerHTML = `
        <td>
          <div style="display: flex; justify-content: flex-left; text-align: left; margin-left: 10px; align-items: center;">
            <color-dot ${item.priority}> </color-dot>
            <div ${bgStyle}>
              <a title="레드마인(${divChar}:${num}) 으로 이동" style="width: 4rem;" href="http://REDMINE_IPADDR/redmine/issues/${num}" target="_blank"> ${divChar}:${num}${title} [${item.autho}] &nbsp; </a>
            </div>
          </div>
        </td>
      `
  }).join("") : `<span class="issue-clear">&#127881;</span>`
  // above part of cell2.innerHTML = `<a title="레드마인(${divChar}:${num}) 으로 이동" style="width: 4rem;" href="http://REDMINE_IPADDR/redmine/issues/${num}" target="_blank"> ${divChar}:${num}${title} [${item.autho}] &nbsp; </a>
  // <a title='생성자:${item.author}' href="javascript:showModal('${encoded}')">${title} &nbsp;</a>`
}

function showModal(encoded) {
  const decoded = decodeURIComponent(escape(atob(encoded)))
  const item = JSON.parse(decoded)
  // console.log({encoded, decoded, item})
  const modal = document.getElementById('detailModal')
  const html = getDetailTable(item)
  console.log({ modal, html })
  // modal.innerHTML = html
  const table = document.getElementById('detailTable')
  table.innerHTML = html
  modal.style.display = 'block'
}

function hideModal() {
  const modal = document.getElementById('detailModal')
  modal.style.display = 'none'
}
// When the user clicks anywhere outside modal, close it
window.onclick = function (event) {
  const modal = document.getElementById('detailModal')
  if (event.target == modal) {
    modal.style.display = 'none'
  }
}

function getDetailTable(item) {
  let content = '<h3>상세정보</h3>'
  const priorityColor = getPriorityColor(item.priority)
  //&#9989
  content += `
    <color-dot ${item.priority}></color-dot> 일감: <a title='레드마인으로이동' href='http://REDMINE_IPADDR/redmine/issues/${item.issue_number}' target="_blank">${item.channelDivId}${item.issue_number} ${item.subject}</a>
      <p>&nbsp;&nbsp;&nbsp;&nbsp; #${item.channel_div} #${item.product_div} #${item.issue_kind} #${item.priority} #${item.current_status}
  `

  let table = `
    <div class="onepiece">
      <div class="trow">
  `

  const keys = Object.keys(item)
  table += `
    <table class="table-widget">
    <tr>
      <th width="30%" style="text-align: center;">구분</th>
      <th width="70%"> 내용 </th>
    </tr>
  `

  function makeRow(key, value, opt = {}) {
    let tagStart = '', tagEnd = ''
    if (opt.pre) {
      tagStart = '<pre>'
      tagEnd = '</pre>'
    }
    return `
        <tr>
          <td style="text-align: center;">
            ${key}
          </td>
          <td>
            ${tagStart}${value}${tagEnd}
          </td>
        </tr>
      `
  }

  function getHistoryHtml(param = []) {
    const history = param.filter((v, i, a) => a.findIndex(v2 => (v2.change_date === v.change_date)) === i) // remove duplicate change_date
    return history.map(item => {
      return `
          <small style="background-color: whitesmoke;"><i> ${item.change_date} : ${item.translated} </i> </small> <br><br>
          <small style="white-space: pre-wrap;">${item.note}</small> <hr>
        `
    }).join('')
  }

  const nvl = val => val || 'N/A';
  table += makeRow('설명', nvl(item.description), { pre: true })
    + makeRow('등록자', nvl(item.author))
    + makeRow('등록일', nvl(item.reg_date))
    + makeRow('담당자', nvl(item.current_worker))
    + makeRow('이력', getHistoryHtml(item.history_list))
    + `
            </table>
          </div>
        </div>
      `
  content += table
  return content
}








document.addEventListener('DOMContentLoaded', () => {
  const browser = getCurrentBrowser(window.navigator.userAgent)
  console.log(browser)
  if (browser === 'ie') {
    alert('chrome or edge plz..')
    window.close()
  }

  const root = document.getElementById('root')
  let bigRecords = 'BIG_RECORDS'
  let smallRecords = 'SMALL_RECORDS'
  let contents = `CONTENT_HERE`
  // contents += '<div class="row">' + getTable(header, testCustomers.data) + '</div>'

  currentIssueList = bigRecords
  currentRequestList = smallRecords

  root.innerHTML = contents

  showAllIssue('big', ['open', 'inProgress', 'reopen'])
  showAllIssue('small', ['open', 'inProgress', 'reopen', 'inReview', 'underReview'])
  categoryButton()
})

