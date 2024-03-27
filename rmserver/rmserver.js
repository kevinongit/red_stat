const express = require('express')
const bodyParser = require('body-parser')
const http = require('http')

const app = express()
const server = http.createServer(app)

const crypto = require('crypto')
const randomId = () => crypto.randomBytes(8).toString("hex")

/// Mock data
const data = require('../ex_rawData')

// app.use(express.json())
app.use(bodyParser.json())

/// enable req.body while http post method.
app.use(bodyParser.urlencoded({ extended: true }))

app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/login.html')
})

app.get('/redmine/proc_status_viewer/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId
    console.log('projectId', projectId)
    if (projectId === 't1.json') {
      res.status(200).json(data.data)
      // res.status(200).json({success: true, message: "Good to go"})
    } else {
      console.log(`unknown (${projectId})`)
      return res.status(404).json([])
    }

  } catch (error) {
    console.log(error)
    res.status(401).json([])
  }
})

app.get('/redmine/issues/:issueNo', async (req, res) => {
  try {
    const issueNo = Number(req.params.issueNo)
    console.log({issueNo})
    const issue = data.data.proc_status.find(ele => ele.issue_number === issueNo) || {mesg: `Not found (${issueNo})`}

    res.status(200).json(issue)

  } catch (error) {
    console.log(error);
    res.status(401).json({error: error.message})
  }
})

// app.post('/test', async (req, res) => {
//   try {
//     const {command} = req.body
//     switch (command) {
//       case 'users':
//         const sockets = await io.fetchSockets()
//         const users = sockets.map(s => s.userId)
    
//         console.log(users)
//         res.status(200).json({success: true, message: "good to go", users})
//         break
//       case 'sessions':
//         res.status(200).json({success: true, sessions: sessionStore.findAllSession()})
//         break;
//       case 'mesg':
//         const {to, content} = req.body
//         const from = 'redmine'
//         const socket = (await io.fetchSockets()).filter(s => s.userId === to)[0]
//         // console.log(socket)
//         if (socket && to && content) {
//           socket.emit('private message', {from, to, content})
//           res.status(200).json({success: true, message: "delivered"})
//         } else {
//           res.status(200).json({success: true, message: "can't delivered"})
//         }
//         break;
//       default:
//         res.status(200).json({success: true, message: "no actions, no consequences"})
//     }
//   } catch (error) {
//     console.log(error)
//     res.status(401).send(error.message)
//   }
// })


const port = 8081
server.listen(port, () => {
    console.log(`✅ listening on *:${port}`)
})
