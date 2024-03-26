const readline = require('readline')
const fs = require('fs')

const file = './server.cfg'

function getConfig() {
  let config = {}
  
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(file),
    })
    
    rl.on('line', function(raw) {
      const line = raw.split('#')[0].trim()
      const [key, value] = line.split('=')
      if (!key || !value) {
        return;
      }
      config[key] = (key === 'YIELD_MEMBER') ? value.split(/,\s+/) : value;
      // console.log(`'${key}' : '${value}'`)
    })
    
    rl.on('close', () => {
      resolve({
        redmineHost: config.REDMINE_HOST,
        concatImprovement: config.CONCAT_IMPROV === 'Y',
        type: config.BULLETIN_TYPE,
        genfile: config.GEN_FILE === 'Y',
        yieldMembers: config.YIELD_MEMBER || [],
      })
    })
  })
}

getConfig().then(config => console.log(config))

module.exports = {
  getConfig,
}
