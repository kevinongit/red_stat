const fs = require('fs')
const http = require('http')

const redStatus = {
  open: '신규',
  inProgress: '조치중',
  reopen: '재결함',
  inReview: '조치완료',
  underReview: '검토완료',
  approved: '확인완료',
  kbReviewed: '현업검토완료',
  prodDeployed: '운영반영완료',
  prodChecked: '운영확인완료',
}

// const MARK1 = "&#9989;"
const MARK1 = "&#10004;"
const MARK_CHECK = "&#10004;"
const MARK_START = "&#10035;"
const MARK_INIT = "&#128154;"
const MARK_PIN = "&#128204;"
const MARK_LIGHTENING = "&#9889;"

// define delay business day
const DELAY_REDLINE = 4
const DELAY_YELLOWLINE = 1

function calculateBizDays(startDate, endDate) {

  startDate.setHours(0,0,0,1)
  endDate.setHours(23,59,59,999)

  const oneDayInMs = 1000 * 60 * 60 * 24
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

  const rtf = new Intl.RelativeTimeFormat('ko', {
    // style: 'narrow',
    numeric: 'always', // 'always' 'auto'
  })
  const rtf2 = new Intl.RelativeTimeFormat('ko', {
    // style: 'narrow',
    numeric: 'auto', // always auto
  })
  // console.log({days, rtf: rtf.formatToParts(-1 * days, 'day'), })
  let dayNum = rtf.formatToParts(-1 * days, 'day').find(x => x.type === 'integer').value
  if (days < 0) dayNum = dayNum * (-1)

  return {
    dayStr: rtf2.format(-1 * days, 'day'),
    dayNum,
    dayColor: getColorByDelayedDay(dayNum).bgColor,
  }
}

function decideIssueType(kind) {
  let type = 'error'
  switch (kind) {
    case '개선사항':
    // case '비결함':
      type = 'noerror'
      break;
  }
  return type
}

function getSummary2(list=[]) {

  const _nonNullValue = (type, fallback) => (...args) => {
    const nnArgs = args.filter(e => e)
    if (type === 'date') {
      return new Date(nnArgs.length ? nnArgs[0] : fallback)
    }
    // default : string
    return nnArgs.length ? nnArgs[0] : fallback
  }
  const nnDate = _nonNullValue('date', '')
  const nnName = _nonNullValue('string', 'noname')

  let scoreCard = {
    total: list.length,
    open: 0,
    inProgress: 0,
    inReview: 0,
    underReview: 0,
    approved: 0,
    kbReviewed: 0,
    prodDeployed: 0,
    prodChecked: 0,
    reopen: 0,

    improvements: 0,
    noissue: 0,
  }
  console.log(`list.length: ${list.length}`)
  let assigneeList = []
  let noerrorList = []
  let delayList =[]
  list.map(item => {
    // status : open, inProgress, ..
    const status = item['current_status']
    // let assignee = null
    let name
    // let issue = null
    const issue = item['issue_number']
    const kind = item['issue_kind']
    const regiDay = nnDate(item['due_date'], item['reg_date'])
    // console.log({regiDay})
    const { dayStr, dayNum, dayColor } = calculateBizDays(regiDay, new Date())

    // console.log({ dayStr, dayNum, dayColor })

    const divisionCharacter = item.channel_div === '인터넷뱅킹' ? 'i' : (item.channel_div === '스타뱅킹' ? 's' : '#')

    item = {...item, dayStr, dayNum, dayColor, divisionCharacter}

    if (kind === '개선사항') {
      scoreCard.improvements++
    } else if (item['issue_kind'] === '비결함') {
      scoreCard.noissue++
    }

    switch (status) {
      case '신규':
      case '재결함':
      case '조치중':
        name = nnName(item['current_worker'], item['author'])

        kind !== '개선사항' && dayNum > 1 && delayList.push({
          name,
          issue,
          dayStr,
          dayNum,
          divisionCharacter,
          isUpgrade: false,
          title: decodeURI(item['subject']),
          author: item['author'],
        })
        break
      case '조치완료':
        name = nnName(item['current_wroker'], item['fix_worker'], item['author'])
        break
      case '검토완료':
      case '확인완료':
      case '현업검토완료':
      case '운영반영완료':
      case '운영확인완료':
        name = nnName(item['current_worker'], item['author'])
        break
      default:
        console.log(`warning: unknown status 2(#${item['issue_number']} ${status}) ...`)
        console.log(JSON.stringify(item))
        break
    }

    // let's clarify issue type : 'error' | 'noerror'
    let currentList = decideIssueType(kind) === 'noerror' ? noerrorList : assigneeList

    let assignee = currentList.find(a => a.name === name)

    if (!assignee) {
      assignee = {
        name,
        count: 0,
        open: [],
        inProgress: [],
        inReview: [],
        underReview: [],
        approved: [],
        kbReviewed: [],
        prodDeployed: [],
        prodChecked: [],
        reopen: [],
        issues: [],
      }
      currentList.push(assignee)
    }
    const key = Object.keys(redStatus).find(key => redStatus[key] === status)
    const decoded = item['author'] + ': ' + item['subject']
    if (key) {

      assignee[key].push({
        kind,
        num: issue,
        title: decoded,
        item, // 2022.08.01 for inline detail modal popup
      })
      scoreCard[key]++
      assignee.count++
    } else {
      console.log(`+ warning: unknown status(${status})`)
    }

    currentList = currentList.map(a => a.name === assignee.name ? assignee : a)
  })
  const sortList = list => list.sort((a,b) => (b.open.length + b.inProgress.length) - (a.open.length + a.inProgress.length))
  const sorted = sortList(assigneeList)
  const sorted2 = sortList(noerrorList)
  // console.log(sorted)
  const defectStatus = {}, improveStatus = {}
  let dsum = 0, isum = 0
  Object.keys(redStatus).map(key => {
    defectStatus[key] = sorted.map(x => x[key].length).reduce((acc, cur) => (acc+cur), 0)
    dsum += defectStatus[key]
    improveStatus[key] = sorted2.map(x => x[key].length).reduce((acc, cur) => (acc+cur), 0)
    isum += improveStatus[key]
  })
  defectStatus.total = dsum
  improveStatus.total = isum

  return {
    status: scoreCard,
    defectStatus,
    improveStatus,
    records: sorted,
    records2: sorted2,
    delayList,
  }
}


function timestamp2() {
  const today = new Date()
  today.setHours(today.getHours() + 9)

  return today.toISOString().replace('T', ' ').substring(5, 16)
}

function getFilteredRecords(records, filters) {
  function getFilteredCount(tuple, filters) {
    return filters.map(key => tuple[key].length).reduce((acc, cur) => (acc + cur), 0)
  }

  return records.filter(record => getFilteredCount(record, filters))
}

function getTableHeader(prefix, status) {
  const undone = status.open + status.inProgress + status.reopen
  const done = status.total - undone
  const percent = `${status.total === 0 ? 0 : ((done / status.total) * 100).toFixed(0)}`

  const disabled = status.total ? '' : 'disabled'
  const issue1Class = disabled ? 'issue1-disabled-button' : 'issue1-button' /// FIXME disable is always true
  return `
    <h3> ${MARK1} ${prefix === 'small' ? '개선사항' : '일감'} 조치현황
      <button ${disabled} class ="${issue1Class}" title="신규,조치중,재결함" onclick="showAllIssue('${prefix}', ['open', 'inProgress', 'reopen'])">진행중</button>
      <button ${disabled} class ="${issue1Class}" title="클리어" onclick="showAllIssue('${prefix}', [])">지움</button>
      <label for="progress-bar"> 진행율 ${percent}% </label> <progress id="progress-bar" value="${percent}" max="100"> ${percent} </progress>
    </h3>
    <!--
      <div class="prgoress">
        <div class="bar" style="width: ${percent}">${percent} </div>
      </div>
    -->
    <p class="subtitle"> 조치율 ${percent}% [전체: ${status.total}, 진행중: ${undone}] </p>
    <span style="color: red; font-size: 14px; font-weight: bold;"> &nbsp; ${MARK_START} &nbsp; 숫자버튼을 클릭하면 해당 유형만 링크에 표시됨. </span>
  `
}

function getTableBody(prefix, header, records) {
  function getColumnTh(header) {
    let cols = ''
    let thHtml = ''
    header.forEach(({width, title}) => {
      cols += `<col span="1" width="${width}" style="background-color: #FF9C4; " >`
      thHtml += `<th style="text-align: center; background: #808080;">${title}</th>`
    })
    return `
      <colgroup> ${cols} </colgroup>
      <tr> ${thHtml} </tr>
    `
  }

  if (!records || !records.length) return ''

  let table = `<div class="onepiece"><div class="trow"><div class="tcards "><table id="${prefix}-table" class="guide_table"> ${getColumnTh(header)}`

  records.map((record, idx) => {
    let tdHtml = ''

    const rowspan = 1

    // console.log({idx, rowspan})

    // let linkCount = 0
    header.map(({key, copiable}) => {

      function getCopyButton(value) {
        return `
          <div class="td-edit">
            <button class="td-button" onclick="copyToClipboardByValue('${value}')">Copy</button>
          </div>
        `
      }

      const needLink = Array.isArray(record[key]) && record[key].length > 0 //&& key !== 'approved'
      let text = redStatus.hasOwnProperty(key) ? record[key].length : (record[key] || 'TODO')

      const tdId = `${prefix}_${idx}_${key}`
      const bgcolor = key === 'kbReviewed' ? 'bgcolor="lime"' : ''
      tdHtml += `
        <td id="${tdId}" ${bgcolor} style="text-align: center; word-break: break-all;" rowspan="${rowspan}">
          <div class="${copiable ? 'td-block-multi' : 'td-block'}">
            <div class="td-edit">
              ${needLink ? `<button class="issue2-button" onclick="showIssueWithInit('${prefix}', ${idx}, '${key}')"> ${text} </button>`
               : text}
            </div>
            ${copiable ? getCopyButton(record[key]) : ''}
          </div>
        </td>
      `
    })

    table += `
      <tr id="${prefix}_tr_${idx}">
        ${tdHtml}
      </tr>
    `
  })

  // unreachable
  if (records.length === 0) {
    table += `
      <tr id="empty">
        <td colspan="${header.length}" style="text-align: center; word-break: break-all;">
          <div class="td-block">
            <div class="td-edit">
              No records.
            </div>
          </div>
        </td>
      </tr>
    `
  }

  table += '</table></div></div></div> <br>'

  return table
}

function getTable(prefix, status, records) {
  if (!records || !records.length) return ''
  const header = [{
      key: 'name',
      title: '담당자',
      width: '10%',
    },
    {
      key: 'open',
      title: '신규',
      width: '5%',
    },
    {
      key: 'inProgress',
      title: '조치중',
      width: '5%',
    },
    {
      key: 'reopen',
      title: '재결함',
      width: '5%',
    },
    {
      key: 'inReview',
      title: '조치완료',
      width: '5%',
    },
    {
      key: 'underReview',
      title: '검토완료',
      width: '5%',
    },
    {
      key: 'approved',
      title: '확인완료',
      width: '5%',
    },
    {
      key: 'kbReviewed',
      title: '현업검토완료',
      width: '5%',
    },
    {
      key: 'prodDeployed',
      title: '운영반영완료',
      width: '5%',
    },
    {
      key: 'prodChecked',
      title: '운영확인완료',
      width: '5%',
    },
    {
      key: 'status',
      title: '상태',
      width: '5%',
    },
    {
      key: 'issues',
      type: 'issueLink',
      title: '링크',
      width: '55%',
    },
  ]

  const undone = status.open + status.inProgress + status.reopen
  const done = status.total - undone
  const percent = `${status.total === 0 ? 0 : ((done / status.total) * 100).toFixed(0)}`

  const disabled = records.length ? '' : 'disabled'
  const issue1Class = disabled ? 'issue1-disabled-button' : 'issue1-button' /// FIXME
  let content = `
    <h3> ${MARK1}
      ${prefix === 'small' ? '개선사항' : '일감'} 조치현황
      <button ${disabled} class="${issue1Class}" title="신규,조치중,재결함" onclick="showAllIssue('${prefix}', ['open', 'inProgress', 'reopen'])">진행중</button>
      <button ${disabled} class="${issue1Class}" title="클리어" onclick="showAllIssue('${prefix}', [])">지움</button>
      <label for="progress-bar"> 진행율 ${percent}% </label> <progress id="progress-bar" value="${percent}" max="100"> ${percent} </progress>
    </h3>
    <!--
      <div class="progress">
        <div class="bar" style="width: ${percent}">${percent}</div>
      </div>
    -->
    <p class="subtitle"> 조치율 ${percent}% [전체: ${status.total}, 진행중: ${undone}] </p>
    <span style="color: red; font-size: 14px; font-weight: bold;"> &nbsp; ${MARK_START}&nbsp; 숫지 버튼 클릭하면 해당 유형만 링크에 표시됨. </span>
  `

  let table = `
    <div class="onepiece">
      <div class="trow">
        <div class="tcards">
  `
  table += `<table id="${prefix}-table" class="guid_table">`

  let thHtml = '', cols = ''

  header.forEach(hdr => {
    cols += `
      <col span="1" width="${hdr.width}" style="background-color: #FF9C4; ">
    `
    thHtml += `
      <th style="text-align: center; background: #008080;"> ${hdr.title}</th>
    `
  })
  table += `
    <colgroup>
      ${cols}
    </colgroup>
    <tr>
      ${thHtml}
    </tr>
  `

  let offset = 0 // for dynamic status, issues html (tr/td)
  records.map((record, idx) => {
    // if (!row.title || !row.title.length) return
    // table += ``
    let tdHtml = ''

    const rowspan = 1

    // console.log({idx, rowspan})

    let linkCount = 0
    header.map(({key}, jdx) => {
      let copyButton = ''
      let blockStyle = 'td-block'

      if (header[jdx].copiable && record[key].length > 0) {
        const copyValue = record[key]
        copyButton = `
          <div class="td-edit">
            <button class="td-button" onclick="copyToClipboardByValue('${copyValue}')">Copy</button>
          </div>
        `
        blockStyle = 'td-block-multi'
      }

      const needLink = Array.isArray(record[key]) && record[key].length > 0 // && key != 'approved'
      if (needLink) linkCount += record[key].length
      let text = redStatus.hasOwnProperty(key) ? record[key].length : (record[key] || 'TODO')

      const targetId = `${prefix}_${idx}_issues`
      const strRecord = JSON.stringify(record[key])

      const showTag = needLink ? `<button class="issue2-button" onclick="showIssueWithInit('${prefix}', ${idx}, '${key}')"> ${text} </button>` : ''

      const valId = `${prefix}_${idx}_${key}`
      const bgcolor = key === 'kbReviewed' ? 'bgcolor="MediumSpringGreen"' : ''

      tdHtml += `
        <td id="${valId}" ${bgcolor} style="text-align: center; word-break: break-all;" rowspan="${rowspan}">
          <div class="${blockStyle}">
            <div class="td-edit">
              ${needLink ? `<button class="issue2-button" onclick="showIssueWithInit('${prefix}', ${idx}, '${key}')"> ${text} </button>`
                : text }
            </div>
            ${copyButton}
          </div>
        </td>
      `
    })

    table += `
      <tr id="${prefix}_tr_${idx}" data-offset="${offset}" data-items="${linkCount}">
        ${tdHtml}
      </tr>
    `
    offset += linkCount
  })

  if (records.length === 0) {
    table += `
      <tr id="empty">
        <td colspan="${header.length}" style="text-align: center; word-break: break-all;">
          <div class="td-block">
            <div class="td-edit">
              no records.
            </div>
          </div>
        </td>
      </tr>
    `
  }

  table += `
          </table>
        </div>
      </div>
    </div> <br>
  `
  content += table

  return content
}

function getColorByDelayedDay(delayedDay) {
  const bgColor = delayedDay > DELAY_REDLINE ? 'red' : (delayedDay > DELAY_YELLOWLINE ? 'yellow' : (delayedDay >= 0 ? 'aqua' : 'violet'))
  const textColor = (bgColor === 'red' || bgColor === 'violet') ? 'white' : (bgColor === 'yellow' ? 'gray' : 'orange')

  return { bgColor, textColor }
}

function getStatusCircleHtml(dayNum) {
  const { bgColor, textColor } = getColorByDelayedDay(dayNum)
  return `<span class="status" style="background-color: ${bgColor}; font-size: 0.9rem; color: ${textColor}; display: inline-block; text-align: center margin-right: 10px;">${dayNum}d</span>`
}

function getDelayTable(records, redmineHost) {
  const statusRedCount = records.filter(x => x.dayNum > DELAY_REDLINE).length
  const statusYellowCount = records.filter(x => x.dayNum > DELAY_YELLOWLINE).filter(x => x.dayNum <= DELAY_REDLINE).length
  const statusNormalCount = records.length - (statusRedCount + statusYellowCount)
  const aHeader = [{
      title: '상태',
      width: '5%',
    },
    {
      key: 'name',
      title: '담당자',
      width: '10%',
    },
    {
      key: 'dayStr',
      title: '등록일',
      width: '10%',
    },
    {
      key: 'issue',
      type: 'issueLink',
      title: '결함#',
      width: '75%',
    },
  ]

  let content = `<br><br><h3>${MARK_CHECK} 지연일감 현황 (기준 : 2영업일 이상) </h3>
    <p class="subtitle">[전체: ${records.length}, 지연: ${statusRedCount}, 경고: ${statusYellowCount}, 일반: ${statusNormalCount}]</p>
  `

  let table = `
    <div class="onepiece">
      <div class="trow">
        <div class="tcards">
          <table class="guide_table">
  `
  let thHtml = '', cols = ''

  aHeader.forEach(hdr => {
    cols += `
      <col span="1" width="${hdr.width}" style="background-color: #FF9C4;">
    `
    thHtml += `
      <th style="text-align: center;">${hdr.title}</th>
    `
  })
  table += `
    <colgroup>
      ${cols}
    </colgroup>
    <tr>
      ${thHtml}
    </tr>
  `
  const header = aHeader.slice(1) /// remove status maybe

  records.length && records.map((aRecord, idx) => {
    let tdHtml = ''

    const {
      author,
      title,
      dayNum,
      isUpgrade,
      ...record
    } = aRecord

    const statusTag = isUpgrade ? `<span class="issue-clear">${MARK_INIT}</span>` : getStatusCircleHtml(dayNum)
    
    const status = `
      <td style="text-align: center; word-break: break-all;">
        <div class="td-block">
          <div class="td-edit">
            ${statusTag}
          </div>
        </div>
      </td>
    `
    header.forEach(hdr => {
      let blockStyle = 'td-block'
      let text = record[hdr.key]
      if (hdr.type === 'issueLink') {
        const atitle = author + ':' + title
        text = `<br><a title='${atitle}' href='http://${redmineHost}/redmine/issues/${record[hdr.key]}' target="_blank">${record.divisionCharacter}:${record[hdr.key]} - ${atitle} &nbsp;<br></a><br>`
      }
      tdHtml += `
        <td style="text-align: center; word-break: break-all;">
          <div class="${blockStyle}">
            <div class="td-edit">
              ${text}
            </div>
          </div>
        </td>
      `
    })

    table += `
      <tr>
        ${status}
        ${tdHtml}
      </tr>
    `
  })

  console.log(`len = ${records.length}`)
  if (records.length === 0) {
    table += `
      <td colspan="${aHeader.length}" style="text-align: center; word-break: break-all;">
        <div class="td-block">
          <div class="td-edit">
            no records
          </div>
        </div>
      </td>
    `
  }
  table += `
          </table>
        </div>
      </div>
    </div>
  `
  content += table

  return content
}

function getStatus({
  total,
  open,
  inProgress,
  reopen,
  improvements,
  noissue
}) {
  const undone = open + inProgress + reopen
  const done = total - undone
  const percent = `${total === 0 ? 0 : ((done / total) * 100).toFixed(1)} %`

  return `<h3>${MARK1} 요약 [${timestamp2()}]</h3><p class="subtitle">조치율 ${percent} [전체: ${total}, 조치: ${done}, 진행중: ${undone}] (개선사항: ${improvements}, 비결함: ${noissue} 포함)`
}

module.exports = {
  genStat,
}

const bigHeader = [{  //// identical to local header of getTable()
  key: 'name',
  title: '담당자',
  width: '10%',
},
{
  key: 'open',
  title: '신규',
  width: '5%',
},
{
  key: 'inProgress',
  title: '조치중',
  width: '5%',
},
{
  key: 'reopen',
  title: '재결함',
  width: '5%',
},
{
  key: 'inReview',
  title: '조치완료',
  width: '5%',
},
{
  key: 'underReview',
  title: '검토완료',
  width: '5%',
},
{
  key: 'approved',
  title: '확인완료',
  width: '5%',
},
{
  key: 'kbReviewed',
  title: '현업검토완료',
  width: '5%',
},
{
  key: 'prodDeployed',
  title: '운영반영완료',
  width: '5%',
},
{
  key: 'prodChecked',
  title: '운영확인완료',
  width: '5%',
},
{
  key: 'status',
  title: '상태',
  width: '5%',
},
{
  key: 'issues',
  type: 'issueLink',
  title: '링크',
  width: '55%',
},
]

function genStat(orgList, redmineHost) {
  const {
    status,
    defectStatus,
    improveStatus,
    records,
    records2,
    delayList
  } = getSummary2(orgList)

  // console.log({ status, records, delayList })
  const bigPrefix = 'big'
  const smallPrefix = 'small'

  const bigRecords = getFilteredRecords(records, ['open', 'inProgress', 'inReview', 'underReview', 'reopen', 'approved', 'kbReviewed', 'prodDeployed', 'prodChecked'])
  const smallRecords = getFilteredRecords(records2, ['open', 'inProgress', 'inReview', 'underReview', 'reopen', 'approved', 'kbReviewed', 'prodDeployed', 'prodChecked'])

  const statusContent = getStatus(status)

  // const bigContents_ORG = getTable(bigPrefix, defectStatus, bigRecords)
  const bigContents = getTableHeader(bigPrefix, defectStatus) + getTableBody(bigPrefix, bigHeader, bigRecords)
  // console.log({new: bigContents.length, org: bigContents_ORG.length})
  // const bigContents = ''
  const smallContents = getTable(smallPrefix, improveStatus, smallRecords)

  const prodReadyList = orgList.filter(r => r.current_status === '현업검토완료')
  function getProdReadyContents(list) {
    function getListHtml(l) {
      return l.map(item => `<li><a href='http://${redmineHost}/redmine/issues/${item.issue_number}' target='_blank' style='text-decoration: none;'>#${item.issue_number}</a>${item.author}:${item.subject}</li>`).join('<br>')
    }


    const {errorList, improveList} = list.reduce((acc, cur) => {
      cur.issue_kind === '개선사항' ? acc.improveList.push(cur) : acc.errorList.push(cur)
      return acc
    }, {errorList: [], improveList: []})
    console.log({e: errorList.length, i : improveList.length})
    errorList.sort((a,b) => a.issue_number - b.issue_number)
    improveList.sort((a,b) => a.issue_number - b.issue_number)

    let contents = `
      <h3> ${MARK1} 운영 대기 :  ${list.length} 건 </h3>

      <h4 style="margin-left: 10px;">
        ${MARK_PIN} 일감 (${errorList.length}) 
      </h4>
      <ul style="list-style-type:disc;"> 
        ${getListHtml(errorList)} 
      </ul>

      <h4 style="margin-left: 10px;"> 
        ${MARK_PIN} 개선 (${improveList.length}) 
      </h4>
      <ul style="list-style-type:disc;"> 
        ${getListHtml(improveList)} 
      </ul>
    `

    return contents
  }

  const prContents = getProdReadyContents(prodReadyList)
  console.log(prContents)

  const contents = prContents + (bigRecords.length ? bigContents + smallContents : smallContents + bigContents) + getDelayTable(delayList, redmineHost)

  const templateFile = `${__dirname}/template.html`
  console.log({templateFile})
  const tfd = fs.readFileSync(templateFile)
  let html = tfd.toString()

  html = html.replace(/REDMINE_IPADDR/g, redmineHost)
  html = html.replace(/REDSTAT_IPADDR/g, '10.2.26.177')
  html = html.replace('CONTENT_HERE', statusContent + contents)

  html = html.replace("'BIG_RECORDS'", JSON.stringify(bigRecords))
  html = html.replace("'SMALL_RECORDS'", JSON.stringify(smallRecords))

  return html
}

// for test purpose
function load3({type='t1', genfile=false, filter=undefined}) {
  // const opts = {
  //   path : '/redmine/proc_status_viewer/t2.json?key=abcd'
  // }
  let redmineHost = '10.2.26.150'

  console.log('**** Warning : test mode on. (load3)')
  http.get(`http://${redmineHost}/redmine/proc_status_viewer/t2.json?key=the_die_is_cast`, response => {
    let data = ''

    response.on('data', chunk => {
      data += chunk
    })
    response.on('end', () => {
      const result = JSON.parse(data)
      // console.log(result.proc_status.length)
      let html = genStat(result.proc_status, redmineHost)
      html = html.replace('TYPE_HERE', type === 'd1' ? '개발' : (type === 't1' ? '단테' : (type === 't2' ? '통테' : (type === 't3' ? '인수' : '운영'))))
      html = html.replace(' INBANG_BUTTON', filter && filter.includes('인터넷뱅킹') ? " active" : "")
      html = html.replace(' SBANG_BUTTON', filter && filter.includes('스타뱅킹') ? " active" : "")
      html = html.replace(' ALL_BUTTON', !filter ? " active" : "")
      html = html.replace('TARGET_TYPE', type)

      if (genfile) {
        ///TODO : is this ok while daemon exec
        const outfile = './redmine_stat2.html'
        fs.writeFile(outfile, html, 'utf8', (err) => {
          if (err) {
            console.log(`Error while writing : ${outfile}`)
          } else {
            console.log(`file "${outfile}" generated!`)
          }
        })
      }
    })
  }).on('error', (err) => {
    console.log(`Error: ${err.message}`)
  })
}

// load3({type: 't2', genfile: true})
