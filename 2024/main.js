const util = require('./util.js')

const EmojiCheck = '&#10004;'
const EmojiStar = '&#10035;'
const EmojiInit = '&#128154;'
const EmojiPin = '&#128204;'
const EmojiLightening = '&#9889;'

const RedmineHost = '10.2.26.211'

//일감(let's call it worklet instead of issue) status
const WorkletStatus = {
  open: "신규",
  inProgress: "조치중",
  reopen: "재결함",
  inReview: "조치완료",
  underReview: "검토완료",
  approved: "확인완료",
  kbReviewed: "현업검토완료",
  prodDeployed: "운영반영완료",
  prodChecked: "운영확인완료",
}

const DefectColumns =[
  {
    key: 'name',
    title: '담당자',
    width: '10%',
  },
  {
    key: 'open',
    title: '신규',
    width: '5%',
    isOngoing: true,
  },
  {
    key: 'inProgress',
    title: '조치중',
    width: '5%',
    isOngoing: true,
  },
  {
    key: 'reopen',
    title: '재결함',
    width: '5%',
    isOngoing: true,
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
  // {
  //   key: 'kbReviewed',
  //   title: '현업검토완료',
  //   width: '5%',
  // },
  // {
  //   key: 'prodDeployed',
  //   title: '운영반영완료',
  //   width: '5%',
  // },
  // {
  //   key: 'proedChecked',
  //   title: '운영확인완료',
  //   width: '5%',
  // },
  {
    key: 'status',
    title: '상태',
    width: '5%',
  },
  {
    key: 'issues',
    type: 'issueLink',
    title: '링크',
    width: '40%',
  },
]

/** misc functions */
function getFilteredRecords(records, filter) {
  function getFilteredCount(tuple, filter) {
    return filter.map(key => tuple[key].length).reduce((acc, cur) => (acc + cur), 0)
  }
  return records.filter(record => getFilteredCount(record, filter))
}

function getColorByDelayedDay(delayedDay, isActive) {
  const DELAY_REDLINE = 4
  const DELAY_YELLOWLINE = 1
  let bgColor, textColor

  if (!isActive) {
    bgColor = '#BDBDBD' // gray-ish
    textColor = '#212121' // black
  } else if (delayedDay > DELAY_REDLINE) {
    bgColor = '#E91E63' // redish
    textColor = '#F4DF4E' // yellowish
  } else if (delayedDay > DELAY_YELLOWLINE) {
    bgColor = '#F4DF4E'
    textColor = '#03A9F4'
  } else if (delayedDay >= 0) { /// future day
    bgColor = '#03A9F4' // blue-ish
    textColor = '#76FF03' // green-ish
  } else {
    bgColor = '#512DA8'
    textColor = 'white'
  }

  return { bgColor, textColor }
}

function getDayInfoFromBizdays(days) {
  const rtf = new Intl.RelativeTimeFormat('ko', {
    // style: 'narrow',
    numeric: 'always', // 'always', 'auto'
  })
  const rtf2 = new Intl.RelativeTimeFormat('ko', {
    // style: 'narrow',
    numeric: 'auto', // 'always', 'auto'
  })
  // console.log({ days, rtf: rtf.formatToParts(-1 * days, 'day')})
  let dayNum = rtf.formatToParts(-1 * days, 'day').find(x => x.type === 'integer').value
  if (days < 0) dayNum = dayNum * (-1)

  return {
    dayStr: rtf2.format(-1 * days, 'day'),
    dayNum,
  }
}

function analyze(list=[]) {
  const _nonNullDate = fallback => (...args) => {
    const res = args.filter(e => e)
    return new Date(res.length ? res[0] : fallback)
  }
  const nnDate = _nonNullDate('')

  const _nonNullName = fallback => (...args) => {
    const res = args.filter(e => e)
    return res.length ? res[0] : fallback
  }
  const nnName = _nonNullName('미지정')

  let scoreCard = {
    total: list.length,
    open: 0,
    inProgress: 0,
    reopen: 0,
    inReview: 0,
    underReview: 0,
    approved: 0,
    kbReviewed: 0,
    prodDeployed: 0,
    prodChecked: 0,
    
    improvements: 0,
    noissue: 0,
  }
  console.log(`list.length : ${list.length}`)

  let assigneeList = []
  let noerrorList = []
  let delayList = []
  list.map(item => {
    // status: open, inProgress, inReview, underReview, approved, reopen
    const status = item['current_status']
    const issue = item['issue_number']
    const kind = item['issue_kind']
    const regiDay = nnDate(item['due_date'], item['reg_date'])
    const { dayStr, dayNum } = getDayInfoFromBizdays(util.getBizDaysBetween(regiDay, new Date()))
    const divisionCharacter = item.channel_div === '인터넷뱅킹' ? 'i' : (item.channel_div === '스타뱅킹' ? 's' : '#')
    let name

    item = {
      ...item,
      isActive: false,
      dayStr,
      dayNum,
      divisionCharacter,
      dueDate: (new Date(regiDay)).toLocaleString('en-us', {month: 'short', day: 'numeric'}),
    }

    /// 2024.02.13 listType : a variable to distinguish IMPROVEMENTS from ERROR based on 'issue_type' from redmine raw data
    const LIST_IMPROVEMENT = 'IMPROVEMENT'
    const LIST_ERROR = 'ERROR'
    const listType = ['개선사항', '비결함'].includes(item['issue_kind']) ? LIST_IMPROVEMENT : LIST_ERROR

    if (listType === LIST_IMPROVEMENT) {
      scoreCard.improvements++
    }
    /// 2024.02.13 is this still required while '비결함' is already included into improvements
    if (item['issue_kind'] === '비결함') {
      scoreCard.noissue++
    }

    switch (status) {
      case '신규' :
      case '재결함' :
      case '조치중' :
        /// 2024.01.15 isActive : to represent these status
        item.isActive = true
        name = nnName(item['current_worker'], item['author'])
        listType === LIST_ERROR && dayNum > 1 && delayList.push({
          name,
          issue,
          dayStr,
          dayNum,
          divisionCharacter,
          isUpgrade: kind === '개선사항',
          title: decodeURI(item['subject']),
          author: item['author'],
        })
        break;
      case '조치완료':
        name = nnName(item['current_worker'], item['fix_worker'], item['author'])
        break;
      case '검토완료':
      case '현업검토완료':
      case '운영반영완료':
      case '운영확인완료':
      case '확인완료':
        name = nnName(item['current_worker'], item['author'])
        break;
      default:
        console.log(`Warning: unknown status(#${item['issue_number']} ${status}) ... `)
        console.log(JSON.stringify(item))
        break;
    }

    // let's classify issue type : 'error' | 'noerror'
    let currentList = (listType === LIST_IMPROVEMENT) ? noerrorList : assigneeList
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
    const key = Object.keys(WorkletStatus).find(key => WorkletStatus[key] === status)
    const decoded = item['subject']
    if (key) {
      assignee[key].push({
        kind,
        num: issue,
        title: decoded,
        item, /// 2022.08.01 for inline detail modal popup
      })
      scoreCard[key]++
      assignee.count++
    } else {
      console.log(`+ Warning: unknown status(${status})`)
    }

    currentList = currentList.map(a => a.name === assignee.name ? assignee : a)
  })

  const defectStatus = {}, improveStatus = {}
  let dsum=0, isum=0

  Object.keys(WorkletStatus).map(key => {
    defectStatus[key] = assigneeList.map(x => x[key].length).reduce((acc, cur) => (acc + cur), 0)
    dsum += defectStatus[key]

    improveStatus[key] = noerrorList.map(x => x[key].length).reduce((acc, cur) => (acc + cur), 0)
    isum += improveStatus[key]
  })
  defectStatus.total = dsum
  improveStatus.total = isum

  return {
    status: scoreCard,
    defectStatus,
    improveStatus,
    records: assigneeList,
    records2: noerrorList,
    delayList
  }
}

/** common functions for both template and generator. */

/** Html Build up */
const fs = require('fs')

function generateTemplateHtml() {
  const templateFile = fs.readFileSync(`${__dirname}/rs-template.html`)
  const scriptFile = fs.readFileSync(`${__dirname}/rs-script.js`)
  const styleFile = fs.readFileSync(`${__dirname}/rs-style.css`)

  let html = templateFile.toString()

  const scripts = scriptFile.toString() + '\n\n' + getColorByDelayedDay.toString() + '\n\n' + htmlStatusCircle.toString() + '\n\n'

  html = html.replace('$RS_SCRIPT', scripts)
  html = html.replace('$RS_STYLE', styleFile.toString())

  return html
}

function htmlStatus({
  total,
  open,
  inProgress,
  reopen,
  improvements,
  noissue,
}) {
  const undone = open + inProgress + reopen
  const done = total - undone
  const percent = `${total === 0 ? 0 : ((done / total) * 100).toFixed(1)} %`

  return `
    <div class="main_status">
      <h3>${EmojiCheck} 요약 [${util.timestamp()}]</h3> <p class="subtitle"> 조치율 ${percent} [전체: ${total}, 조치: ${done}, 진행중: ${undone}] (개선사항: ${improvements}, 비결함: ${noissue} 포함)
    </div>
  `
}

function htmlStatusCircle(dayNum, dueDate, isActive=undefined) {
  const {
    bgColor,
    textColor
  } = getColorByDelayedDay(dayNum, isActive)
  const dateStr = dayNum < 0 ? `<span style="font-size: 0.7rem;"> ${dueDate} </span>` : ''

  console.log({ dueDate, dateStr })

  return `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <span class="table-row-status" style="background-color: ${bgColor}; font-size: 0.7rem; color: ${textColor}; vertical-align: middle; text-align: center; ">
        ${dayNum}d
      </span>
      ${dateStr}
    </div>
  `
}

function htmlTableDescription(prefix, status) {
  const undone = status.open + status.inProgress + status.reopen
  const done = status.total - undone
  const percent = `${status.total === 0 ? 0 : ((done / status.total) * 100).toFixed(1)}`

  const disabled = status.total ? '' : 'disabled'
  const issue1Class = disabled ? 'issue1-disabled-button' : 'issue1-button'
  const currentTaskName = prefix === 'small' ? '개선사항' : '일감'

  return `
    <div class="table_description">
      <h3> ${EmojiCheck} ${currentTaskName} 조치현황 </h3>
      <p class="subtitle"> ${currentTaskName} [전체 : ${status.total}, 진행중 : ${undone}]
        <progress id="progress-bar" value="${percent}" max="100"> ${percent} </progress>
        ${percent}%
      </p>
    </div>
  `
}

function htmlTableBody(prefix, caption, header, records) {
  function getColumnTh(header) {
    let cols = ""
    let thHtml = ""
    header.forEach(({width, title}) => {
      cols += `<col span="1" width="${width}" style="background-color: #FF9C4;">`
      thHtml += `
        <th style="text-align: center;">${title}</th>
      `
    })
    return `
      <colgroup> ${cols} </colgroup>
      <thead>
        <tr> ${thHtml} </tr>
      </thead>
    `
  }

  if (!records || !records.length) return ''

  let table = `
    <div id="${prefix}-table-widget" class="table-widget">
      <table id="${prefix}-table" class="guide_table">
        <caption>
          <div class="table-caption">
            <svg width="24" height="24" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
              <path fill="#000000" d="M31.43 16H10v2h21.43a1 1 0 0 0 0-2" class="clr-i-outline clr-i-outline-path-1"/>
              <path fill="#000000" d="M31.43 24H10v2h21.43a1 1 0 0 0 0-2" class="clr-i-outline clr-i-outline-path-2"/>
              <path fill="#000000" d="M15.45 10h16a1 1 0 0 0 0-2h-14Z" class="clr-i-outline clr-i-outline-path-3"/>
              <path fill="#000000" d="M17.5 3.42a1.09 1.09 0 0 0-1.55 0l-8.06 8.06l-3.38-3.64a1.1 1.1 0 1 0-1.61 1.5l4.94 5.3L17.5 5a1.1 1.1 0 0 0 0-1.58" class="clr-i-outline clr-i-outline-path-4"/>
              <path fill="none" d="M0 0h36v36H0z"/>
            </svg>

            <span>${caption}</span>
            <div class="button-group">
              <div class="active-button" onclick="showAllIssue('${prefix}', ['open', 'inProgress', 'reopen'])">
                <svg width="24" height="24" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#000000" d="M57.599 28.635c-.945-1.903-2.776-2.995-5.021-2.995c-6.934 0-11.468 7.783-11.468 7.783V11.142c0-5.64-5.637-7.521-8.554-5.389c-1.293-4.81-8.922-4.936-10.319-.726c-2.354-1.741-7.857-.612-8.499 4.47a5.607 5.607 0 0 0-1.677-.255c-3.14 0-5.599 2.549-5.599 5.802c.003.188.379 15.3-.066 20.373c-.479 5.467-1.019 11.851 1.634 18.005C10.277 58.634 16.308 62 23.395 62c8.758 0 16.567-4.898 20.889-13.105c2.265-4.302 5.713-7.905 8.482-10.8c3.643-3.806 6.274-6.555 4.833-9.46M7.917 35.572c.341-5.115.251-14.739.251-19.866c0-4.774 5.871-4.937 5.871-2.929l.339 16.688l1.405 1.923V10.311c0-3.306 4.541-4.949 6.364-2.886v22.073l1.559 1.89V7.174c0-4.35 7.215-4.479 7.215-.419v22.743l1.521 1.89V7.969c1.001-1.422 6.173-.794 6.173 2.846v23.921C32.023 34.5 22.138 39.55 23.456 49.81c.876-9.66 10.124-12.862 15.143-12.862c1.746 0 2.872-1.134 2.872-1.134c-.005-.002-.009-.004-.014-.004c.968-.757 5.234-8.309 10.271-8.309c1.481 0 4.169.464 2.793 3.973c-2.164 5.521-8.421 6.817-13.548 16.645c-5.766 11.051-21.2 14.715-28.534 8.053c-5.731-5.209-4.807-16.325-4.522-20.6"/>
                </svg>
              </div>


              <div class="active-button" onclick="showAllIssue('${prefix}', [])">
                <svg width="48" height="48" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="23.56" cy="17.74" r="1.95" fill="#000000" class="clr-i-outline clr-i-outline-path-1"/>
                  <circle cx="22.42" cy="25.88" r="1.58" fill="#000000" class="clr-i-outline clr-i-outline-path-2"/>
                  <circle cx="12.86" cy="17.74" r="1.95" fill="#000000" class="clr-i-outline clr-i-outline-path-3"/>
                  <circle cx="13.99" cy="25.88" r="1.58" fill="#000000" class="clr-i-outline clr-i-outline-path-4"/>
                  <path fill="#000000" d="M30.83 20H29a19.29 19.29 0 0 0-1.18-5.73l1.46-.79a1 1 0 0 0-.95-1.76l-3 1.64A17.65 17.65 0 0 1 27 20.72c0 6.28-3.2 10.51-8.2 10.9V15h-1.6v16.62C12.22 31.21 9 27 9 20.72a17.74 17.74 0 0 1 1.73-7.34L7.7 11.72a1 1 0 0 0-.95 1.76l1.5.8A19.38 19.38 0 0 0 7.07 20h-1.9a1 1 0 0 0 0 2H7.1a14.62 14.62 0 0 0 1.66 6.17l-1.89 1.32A1 1 0 1 0 8 31.12l1.84-1.29A10.38 10.38 0 0 0 18 33.66a10.38 10.38 0 0 0 8.14-3.81L28 31.12a1 1 0 1 0 1.15-1.64l-1.86-1.3A14.61 14.61 0 0 0 28.94 22h1.89a1 1 0 0 0 0-2" class="clr-i-outline clr-i-outline-path-5"/>
                  <path fill="#000000" d="M11.51 5.36a1.67 1.67 0 0 0 1.07-.51A3.21 3.21 0 0 1 13.76 6a16.38 16.38 0 0 0-2.65 2.89a2 2 0 0 0 1.61 3.19h10.6A2 2 0 0 0 25.1 11a2 2 0 0 0-.17-2.1A16.34 16.34 0 0 0 22.25 6a3.21 3.21 0 0 1 1.17-1.11A1.68 1.68 0 1 0 23 3.27A4.77 4.77 0 0 0 21 5a5.81 5.81 0 0 0-2.93-1a5.83 5.83 0 0 0-3 1A4.77 4.77 0 0 0 13 3.27a1.68 1.68 0 1 0-1.49 2.09m6.49.71c1.45 0 3.53 1.57 5.31 4h-10.6c1.78-2.44 3.85-4 5.29-4" class="clr-i-outline clr-i-outline-path-6"/>
                  <path fill="none" d="M0 0h36v36H0z"/>
                </svg>
              </div>

            </div>
          </div>
        </caption>
        ${getColumnTh(header)}

        <tbody id="table-rows">
  `

  records.map((record, idx) => {
    let tdHtml = ""

    const rowspan = 1

    header.map(({key, isOngoing}) => {
      function getCopyButton(value) {
        return `
          <div class="td-edit">
            <button class="td-button" onclick="copyToClipboardByValue('${value}')">Copy</button>
          </div>
        `
      }
      const needLink = Array.isArray(record[key]) && record[key].length > 0 
      let text = WorkletStatus.hasOwnProperty(key) ? record[key].length : (record[key] || 'TODO')
      const copiable = undefined

      const tdId = `${prefix}_${idx}_${key}`
      const bgColor = key === 'kbReviewed' ? 'background-color="lime"' : ''
      const buttonOrTextHtml = `
        ${needLink ? `<button class="${isOngoing ? 'issue2' : 'inactive-issue'}-button" onclick="showIssueWithInit('${prefix}', ${idx}, '${key}')"> ${text} </button>` : text }
      `

      tdHtml += `
        <td id="${tdId}" ${bgColor} style="text-align: center; word-break: break-all;" rowspan="${rowspan}">
          <div class="${copiable ? 'td-block-multi' : 'td-block'}" >
            <div class="td-edit">
              ${buttonOrTextHtml}
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

  /// unreachable
  if (records.length === 0) {
    table += `
      <tr id="non-exist">
        <td colspan="${header.length}" style="text-align: center; word-break: break-all;">
          <div class="td-block">
            <div class="td-edit">
              존재하지 않습니다.
            </div>
          </div>
        </td>
      </tr>
    `
  }

  table += '</tbody></table> </div> <br>'

  return table
}

/** main interface */
function generateReportHtml(orgList, configOpts) {
  function sortCompare(a,b) {
    return (b.open.length + b.inProgress.length + b.reopen.length) - (a.open.length + a.inProgress.length + a.reopen.length)
  }

  const {redmineHost=RedmineHost, concatImprovement=false, yieldMembers} = configOpts
  const {
    status,
    defectStatus,
    improveStatus,
    records,
    records2,
    delayList
  } = analyze(orgList)

  console.log({redmineHost, concatImprovement})
  const bigPrefix = 'big'
  const smallPrefix = 'small'

  const RedmineFullStates = ['open', 'inProgress', 'inReview', 'underReview', 'reopen', 'approved', 'kbReviewed', 'prodDeployed', 'prodChecked']

  let bigRecords = getFilteredRecords(records, RedmineFullStates)
  let smallRecords = getFilteredRecords(records2, RedmineFullStates)

  if (concatImprovement) {
    smallRecords.map((small) => {
      let big = bigRecords.find(e => e.name === small.name)
      if ( !big ) {
        bigRecords = bigRecords.concat(small)
      } else {
        RedmineFullStates.map(key => {
          big[key] = big[key].concat(small[key])
        })
      }
    })
    smallRecords = [] /// emptify
  }

  if (yieldMembers.length > 0) {
    function makeThemFirst(list) {
      let yieldList = list.filter(ele => yieldMembers.includes(ele.name))
      let siList = list.filter(ele => !yieldMembers.includes(ele.name))

      yieldList = yieldList.sort(sortCompare)
      siList = siList.sort(sortCompare)

      return yieldList.concat(siList)
    }

    bigRecords = makeThemFirst(bigRecords)
    smallRecords = makeThemFirst(smallRecords)
  } else {
    bigRecords = bigRecords.sort(sortCompare)
    smallRecords = smallRecords.sort(sortCompare)
  }

  const statusContent = htmlStatus(status)

  const bigContents = htmlTableDescription(bigPrefix, defectStatus) + htmlTableBody(bigPrefix, '일감목록', DefectColumns, bigRecords)
  const smallContents = smallRecords.length ? htmlTableDescription(smallPrefix, improveStatus) + htmlTableBody(smallPrefix, '개선사항목록', DefectColumns, smallRecords) : '[Temp Measure] - No 개선사항'

  const prodReadyList = orgList.filter(r => r.current_status === '현업검토완료')

  function getProdReadyContents(list) {
    const {errorList, improveList} = list.reduce((acc, cur) => {
      cur.issue_kind === '개선사항' ? acc.improveList.push(cur) : acc.errorList.push(cur)
      return acc
    }, {errorList: [], improveList: []})
    console.log({e: errorList.length, i: improveList.length })
    errorList.sort((a,b) => a.issue_number - b.issue_number)
    improveList.sort((a,b) => a.issue_number - b.issue_number)
    const elistContent = errorList.map(item => {
      return `<li><a href='http://${redmineHost}/redmine/issues/${item.issue_number}' target='_blank' style='text-decoration: none;'>#${item.issue_number}</a> ${item.subject}</li>`
    }).join("<br>")
    const ilistContent = improveList.map(item => {
      return `<li><a href='http://${redmineHost}/redmine/issues/${item.issue_number}' target='_blank' style='text-decoration: none;'>#${item.issue_number}</a> ${item.subject}</li>`
    }).join("<br>")

    let contents = `
      <div class="prod-ready">
        <h3> ${EmojiCheck} 운영 대기 : ${list.length} 건 </h3>
          <h4 style="margin-left: 10px;"> ${EmojiPin} 일감 (${errorList.length}) </h4>
          <ul style="list-style-type: disc;">
            ${elistContent}
          </ul>
          <h4 style="margin-left: 10px;"> ${EmojiPin} 개선 (${improveList.length}) </h4>
          <ul style="list-style-type: disc;">
            ${ilistContent}
          </ul>
      </div>
    `
    return contents
  }

  const prContents = getProdReadyContents(prodReadyList)
  console.log(prContents)

  const contents = prContents + (bigRecords.length ? bigContents + smallContents : smallContents + bigContents)  // + getDelayTable(delayLisT)

  let html = generateTemplateHtml()

  html = html.replace(/REDMINE_IPARRD/g, redmineHost)
  html = html.replace(/REDSTAT_IPADDR/g, '1.2.3.4')
  html = html.replace('CONTENT_HERE', statusContent + contents)

  html = html.replace("'BIG_RECORDS'", JSON.stringify(bigRecords))
  html = html.replace("'SMALL_RECORDS'", JSON.stringify(smallRecords))

  return html
}

module.exports = {
  generateReportHtml,
}

/** Test Area */

function writeHtml(fname, html) {
  fs.writeFile(`${__dirname}/${fname}`, html, 'utf-8', (err) => {
    if (err) {
      console.log(`error while writing..(${__dirname}/${fname})`)
    } else {
      console.log(`${__dirname}/${fname} generated`)
    }
  })
}

function writeTestHtml() {
  const html = generateTemplateHtml()

  writeHtml('gen-test.html', html)
}

function simulate() {
  function loadTestData() {
    const testData = require('./testData1').testData

    return testData
  }

  const testData = loadTestData()
  console.log('testData.proc_status.length: ', testData.proc_status.length)
  const html = generateReportHtml(testData.proc_status)

  writeHtml('gen-simulate.html', html)
}

// writeTestHtml()
// simulate()
