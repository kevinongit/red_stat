// let form = new URLSearchParams()
// const REDMINE_HOST = '10.2.26.211'
const http = require('http')
const url = require('url')
const fs = require('fs')
const path = require('path')
const topdir = process.cwd() + "/archive"
const genStat = require('./main')
const util = require('./util')

let CachedProcStatus = {}

if (!fs.existsSync(topdir)) {
  fs.mkdirSync(topdir)
}

const ext = path.extname('index.html')

let ipaddr = '0.0.0.0'
// const port = 8080
const port = process.env.DEV ? 8080 : 80

/// windows10 OK, but Mac NOK.
function getIpaddr() {
  const dns = require('dns')
  const os = require('os')
  return new Promise((resolve, reject) => {
    const hostname = os.hostname()

    console.log({hostname, __dirname, __filename, main: require.main.filename})
    dns.lookup(hostname, (err, address, family) => {
      if (err) reject(err)
      else resolve(address)

      console.log({err, address, family })
    })
  })
}

/// 2023/03/17 it's ok on Mac.
function getIpaddr2() {
  const netInterfaces = require('os').networkInterfaces()
  console.log(netInterfaces)
  const ipaddr = Object.values(netInterfaces)
    .flat().filter(({family, internal}) => family === 'IPv4' && !internal)
    .map(({ address }) => address)
  return ipaddr
}

function getLogStream(logdir="logs") {
  if (!fs.existsSync(logdir)) {
    fs.mkdirSync(logdir)
  }
  const fname = `${logdir}/rslog_${util.timestamp().slice(0,5).replace('-', '')}.log`;
  console.log(`logfile : ${fname}`);

  return fs.createWriteStream(`${fname}`, {flags: 'a' })
}



function getRedmineData(rmHost, {type= 't1', simMode= false, filter= undefined}) {
  console.log({type, simMode, filter })
  return new Promise((resolve, reject) => {
    if (simMode) {
      console.log('[TEST MODE]')
      let data = (require('./ex_rawData'))
      // console.log(data.data)
      resolve(data.data.proc_status)
    } else if (filter && CachedProcStatus[type] && CachedProcStatus[type].length) {
      const filteredProcStatus = CachedProcStatus[type].filter(e => e.channel_div === filter)
  
      console.log('[filteredProcStatus]', filteredProcStatus.length)
      resolve(filteredProcStatus)
    } else {
      const serverUrl = `http://${rmHost}/redmine/proc_status_viewer/${type}.json`
      console.log('[HTTP REQUEST]', {serverUrl})
      http.get(serverUrl, response => {
        let data = ''
        
        response.on('data', chunk => {
          data += chunk
        })
        response.on('end', () => {
          const result = JSON.parse(data)
          console.log({result})
          /// Cache result.proc_status for filtering : all / inbang / sbang
          CachedProcStatus[type] = result.proc_status || []
          console.log('22222', CachedProcStatus[type] && CachedProcStatus[type].length)
          
          resolve(result.proc_status || [])
          
        })
      }).on('error', (err) => {
        console.log(`Error : ${err.message}`)
        reject(err.message)
      })
    }
  })
}

const logStream = getLogStream()

http.createServer(async (req, res) => {
  try {
    const config = await require('./loadConfig').getConfig()
    console.log({config})
    
    const reqUrl = url.parse(req.url).pathname
    const params = JSON.parse(JSON.stringify(url.parse(req.url, true).query)) // fix [Object: null prototype]
    const decodeUrl = decodeURIComponent(reqUrl)
    // const req_url = decodeURIComponent(req.url).replace(/\/+/g, '/')

    const {type, filter, genfile} = params
    console.log({params})

    // const newParams = new URL(req.url, `http://localhost:${port}/redstat)
    // console.log({newParams})

    console.log({time: new Date().toLocaleString(), from: req.socket.remoteAddress})
    console.log({r_url: req.url, reqUrl, decodeUrl})

    logStream.write(`o ${util.timestamp().slice(6)} - request from ${req.socket.remoteAddress} [ ${decodeUrl}, ${JSON.stringify(params)} ]\n`)

    if (reqUrl === '/redstat') {
      // loadRedmineData(res, params)
      const redmineHost = '0.0.0.0:8081'

      let proc_status = await getRedmineData(redmineHost, config)
      console.log({proc_status})
      let html = genStat.generateReportHtml(proc_status, config)
      html = html.replace('TYPE_HERE', type === 'd1' ? '개발' : (type === 't1' ? '단테' : (type === 't2' ? '통테' : (type === 't3' ? '인수' : '운영' )) ))
      html = html.replace(' INBANG_BUTTON', filter && filter.includes('인터넷뱅킹') ? " active" : "")
      html = html.replace(' SBANG_BUTTON', filter && filter.includes('스타뱅킹') ? " active" : "")
      html = html.replace(' ALL_BUTTON', !filter ? " active" : "")
      html = html.replace('TARGET_TYPE', type)
      // console.log(html)
      if (genfile) {
        /// TODO : is this ok while daemon exec
        const outfile = './archive/redmine_stat2.html'
        fs.writeFile(outfile, html, 'utf8', (err) => {
          if (err) {
            console.log(`Error whilte writing : ${outfile}`)
          } else {
            console.log(`+ file '${outfile}' is generated.`)
          }
        })
      }
      res.writeHead(200, 'Content-Type', 'text/html; charset=utf-8')
      res.write(html)
      res.end()

      // res.end("getme called... it's ok")
      return
    }

    const location = topdir + decodeUrl
    const stat = fs.statSync(location)
    if (stat.isFile()) {
      const buffer = fs.createReadStream(location)
      buffer.on('open', () => buffer.pipe(res))
      return
    }

    if (stat.isDirectory()) {
      const list = fs.readdirSync(location, {
        encoding: 'UTF-8',
        // withFileType: false
      })
      console.log(JSON.stringify(list))
      res.writeHead(200, 'Content-Type', 'text/html; charset=utf-8')
      res.end(html_page(`http://${ipaddr}:${port}`, decodeUrl, list))
      return
    }

  } catch(error) {
    res.writeHead(404)
    res.end(error.message)
    console.log(error)
    return
  }
})
.listen(port, '0.0.0.0', async () => {
  // ipaddr = 'localhost'
  // ipaddr = await getIpaddr()
  ipaddr = getIpaddr2()
  console.log(`* server is running on port http://${ipaddr + ':' + port}`)
  logStream.write(`* ${util.timestamp().slice(6)} - server is running on http://${ipaddr + ':' + port} \n`)
  console.log({ipaddr, topdir, ext})
})

function html_page(host, reqUrl, dirs) {
  let list = reqUrl == '/' ? [] : 
    [
      `<a href="${host}">/</a>`,
      `<a href="${host}${encodeURI(reqUri.slice(0, reqUrl.lastIndexOf('/')))}"> .. </a>`,
    ]
  function template(host, reqUrl, file, isFile) {
    return `<a href="${host}${encodeURI(reqUrl)}${reqUrl.slice(-1) == '/' ? '' : '/'}${encodeURI(file)}"> ${isFile ? '&#128196;' : '&#128194;' } ${file} </a>`
  }

  dirs.forEach(file => {
    // const decodeUrl = decodeURIComponent(reqUrl)
    // console.log({decodeUrl})
    // const fstat = fs.statSync(topdir + decodeUrl + "//" + file)
    const fstat = fs.statSync(topdir + reqUrl + "\\" + file)
    // console.log({a: fstat.isFile()})
    list.push(template(host, reqUrl, file, fstat.isFile()))
  })

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset='utf-8'>
      <meta http-equiv='X-UA-Compatible' content='IE=edge'>
      <title>Listing of ${reqIrl}</title>
      <meta name='viewport' content='width=device-width, initial-scale=1'>
      <!-- link rel='stylesheet' type='text/css' media='screen' href='../commonStyle.css' -->
      <!-- script src='main.js'></script -->
    </head>
    <body>
      <h2> Directory of ${reqUrl} &#128194; &#128196; </h2>
      ${list.join('<br>\n')}
    </body>
    </html>
  `
}
