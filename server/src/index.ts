import * as constants from 'constants'
import * as fs from 'fs-extra'
import * as http from 'http'
import * as https from 'https'
import * as md5 from 'md5'
import * as path from 'path'
import * as qs from 'querystring'
import * as read from 'read'
import {
    History, Users, loadConfig, Config, SortedUser, writeConfig,
    getBBCodeOfTable, Table, Row, sleep, Counter, logger, getDifference, getUserFromUid, Rank
} from './utils'
import rp = require('request-promise-native')
import request = require('request')

let config: Config = { password: '', interval: NaN, sleep: NaN, protocol: 'http', host: '', port: NaN, ranks: [], endDate: '' }
let ranks: Rank[] = []
let users: Users = {}
let history: History = {}
let sortedUsers: SortedUser[] = []
let counter: Counter = {}

let rankTable: string
let updateTimeInfo = ''
let registrationBBCode = ''
// let increaseImage: Buffer

let fakeUpdateTimeInfo = ''

let lastUpdateTime: Date

let stopShowingRankTable = false
let freeze = false

async function requestListener(req: http.IncomingMessage, res: http.ServerResponse) {
    const ip = req.connection.remoteAddress
    if (req.method === 'GET') {
        if (req.url && req.url.split('?')[0] === '/api/get-rank-image') {
            const day = getTime(false)
            if (!counter[day]) {
                counter[day] = { view: 0, ips: [] }
            }
            counter[day].view += 1
            if (ip && counter[day].ips.indexOf(ip) === -1) {
                counter[day].ips.push(ip)
                logger.dbug(`New unique ip ${ip}.`)
            }
            await writeConfig('counter.json', counter)
            res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8' })
            res.end(rankTable)
        } else if (req.url === '/api/get-registration-bbcode') {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end(registrationBBCode)
        } else if (req.url === '/api/get-users') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(users))
        } else if (req.url === '/api/get-history') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(history))
        } else if (req.url === '/api/get-ranks') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(ranks))
        } else if (req.url === '/api/get-consts') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({
                endDate: config.endDate,
                interval: config.interval, sleep: config.sleep,
                timestamp: fakeUpdateTimeInfo
            }))
        } else if (req.url === '/api/update-counter') {
            const day = getTime(false)
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({
                view: counter[day].view,
                ip: counter[day].ips.length
            }))
        } else if (req.url === '/favicon.ico') {
            const filePath = path.join(__dirname, '../../client/favicon.ico')
            res.writeHead(200, { 'Content-Type': 'image/x-icon' })
            res.end(await fs.readFile(filePath))
        } else {
            const filePath = path.join(__dirname, '../../client', 'index.html')
            let content = await fs.readFile(filePath, 'utf8')
            content = content.replace(/%\{serverUrl}%/g, `${config.protocol}://${config.host}:${config.port}`)
            res.writeHead(200, { 'Content-Type': `text/html; charset=utf-8` })
            res.end(content)
        }
    } else if (req.method === 'POST') {
        if (req.url === '/api/add-user') {
            const data = await handlePost(req, res)
            if (!data.password || md5(data.password.toString()) !== config.password) {
                logger.warn(`Wrong password from ${ip}.`)
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(getHtmlFromCode(400))
                return
            }
            if (data.uid !== undefined) {
                let result: boolean
                if (data.heartInitial !== undefined) {
                    result = await addUser(parseInt(data.uid as string), parseInt(data.heartInitial as string))
                } else {
                    result = await addUser(parseInt(data.uid as string))
                }
                if (result) {
                    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
                    res.end('S')
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
                    res.end('E')
                }
            } else {
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(getHtmlFromCode(400))
            }
        } else if (req.url === '/api/del-all-users') {
            const data = await handlePost(req, res)
            if (!data.password || md5(data.password.toString()) !== config.password) {
                logger.warn(`Wrong password from ${ip}.`)
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(getHtmlFromCode(400))
                return
            }
            for (const uid in users) {
                if (users.hasOwnProperty(uid)) {
                    delUser(Number(uid))
                }
            }
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('S')
        } else if (req.url === '/api/del-user') {
            const data = await handlePost(req, res)
            if (!data.password || md5(data.password.toString()) !== config.password) {
                logger.warn(`Wrong password from ${ip}.`)
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(getHtmlFromCode(400))
                return
            }
            if (data.uid !== undefined) {
                delUser(parseInt(data.uid as string))
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(getHtmlFromCode(200))
            } else {
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(getHtmlFromCode(400))
            }
        } else if (req.url === '/api/edit-user') {
            const data = await handlePost(req, res)
            if (!data.password || md5(data.password.toString()) !== config.password) {
                logger.warn(`Wrong password from ${ip}.`)
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(getHtmlFromCode(400))
                return
            }
            if (data.uid !== undefined && data.heartInitial !== undefined &&
                data.heartAbandoned !== undefined && data.banned !== undefined) {
                editUser(parseInt(data.uid as string), parseInt(data.heartInitial as string),
                    parseInt(data.heartAbandoned as string), data.banned === 'true')
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(getHtmlFromCode(200))
            } else {
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(getHtmlFromCode(400))
            }
        } else if (req.url === '/api/login') {
            const data = await handlePost(req, res)
            if (data.password && md5(data.password.toString()) === config.password) {
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
                res.end('S')
            } else {
                logger.warn(`Wrong password from ${ip}.`)
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
                res.end('E')
            }
        } else if (req.url === '/api/toggle-showing-rank-image') {
            const data = await handlePost(req, res)
            if (data.password && md5(data.password.toString()) === config.password) {
                stopShowingRankTable = !stopShowingRankTable
                rankTable = await getRankTableSvg()
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
                res.end('S')
            } else {
                logger.warn(`Wrong password from ${ip}.`)
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(getHtmlFromCode(400))
            }
        } else if (req.url === '/api/edit-consts') {
            const data = await handlePost(req, res)
            if (data.password && md5(data.password.toString()) === config.password) {
                if (data.endDate) {
                    const commingEndDate = data.endDate as string
                    const commingTimestamp = data.timestamp as string
                    logger
                        .info('Consts', `- ${config.endDate}, ${fakeUpdateTimeInfo}.`)
                        .info('Consts', `+ ${commingEndDate}, ${commingTimestamp}.`)
                    config.endDate = commingEndDate
                    fakeUpdateTimeInfo = commingTimestamp
                    await writeConfig<Config>('config.json', config)
                    rankTable = await getRankTableSvg()
                    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
                    res.end('S')
                } else {
                    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
                    res.end('Expected constants')
                }
            } else {
                logger.warn(`Wrong password from ${ip}.`)
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(getHtmlFromCode(400))
            }
        } else if (req.url === '/api/edit-history') {
            const data = await handlePost(req, res)
            if (data.password && md5(data.password.toString()) === config.password) {
                if (data.value) {
                    const commingValue = data.value as string
                    try {
                        logger.info('History', `- ${JSON.stringify(history)}.`, `+ ${commingValue}.`)
                        history = JSON.parse(commingValue)
                        await writeConfig<History>('history.json', history)
                        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
                        res.end('S')
                    } catch (e) {
                        logger.eror('History', e.toString())
                        res.end(e.toString())
                    }
                } else {
                    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
                    res.end('Expected history')
                }
            } else {
                logger.warn(`Wrong password from ${ip}.`)
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(getHtmlFromCode(400))
            }
        } else if (req.url === '/api/edit-ranks') {
            const data = await handlePost(req, res)
            if (data.password && md5(data.password.toString()) === config.password) {
                if (data.value) {
                    const commingValue = data.value as string
                    try {
                        logger.info('Ranks', `- ${JSON.stringify(ranks)}.`, `+ ${commingValue}.`)
                        ranks = JSON.parse(commingValue)
                        await writeConfig('ranks.json', ranks)
                        rankTable = await getRankTableSvg()
                        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
                        res.end('S')
                    } catch (e) {
                        logger.eror('Ranks', e.toString())
                        res.end(e.toString())
                    }
                } else {
                    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
                    res.end('Expected ranks')
                }
            } else {
                logger.warn(`Wrong password from ${ip}.`)
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(getHtmlFromCode(400))
            }
        } else {
            res.writeHead(404, 'Resource Not Found', { 'Content-Type': 'text/html' })
            res.end(getHtmlFromCode(404))
        }
    }
}

async function startup() {
    try {
        config = await loadConfig<Config>('config.json',
            {
                password: '', sleep: 500, interval: 600000, port: 80, host: '',
                protocol: 'http', ranks: [], endDate: '1970-01-01'
            }
        )
        users = await loadConfig('users.json', {})
        history = await loadConfig('history.json', {})
        counter = await loadConfig('counter.json', {})
        ranks = await loadConfig('ranks.json', [])

        if (config.password === '') {
            await setPassword()
        }

        setInterval(check, 15000)

        if (config.protocol === 'https' && config.keyFile && config.certFile) {
            https
                .createServer({
                    key: fs.readFileSync(config.keyFile),
                    cert: fs.readFileSync(config.certFile),
                    secureOptions: constants.SSL_OP_NO_TLSv1 | constants.SSL_OP_NO_TLSv1_1
                }, requestListener)
                .listen(config.port)
                .on('error', e => {
                    logger.eror(e.message)
                })
        } else {
            http
                .createServer(requestListener)
                .listen(config.port)
                .on('error', e => {
                    logger.eror(e.message)
                })
        }

        await updateInfo()

        logger.dbug(`Server is running at ${config.protocol}://${config.host}:${config.port}.`)
    } catch (e) {
        logger.eror(e)
    }
}

setImmediate(startup)

async function setPassword() {
    return new Promise<void>((resolve, reject) => {
        read({ prompt: 'Password: ', silent: true }, async (_1, pass) => {
            read({ prompt: 'Password again: ', silent: true }, async (_2, pass2) => {
                if (pass === pass2) {
                    config.password = md5(pass)
                    await writeConfig<Config>('config.json', config)
                    resolve()
                } else {
                    logger.eror('Inconsistent input.')
                    reject()
                    process.exit()
                }
            })
        })
    })
}

async function handlePost(req: http.IncomingMessage, res: http.ServerResponse) {
    let body = ''
    return new Promise<qs.ParsedUrlQuery>((resolve, reject) => {
        req.on('data', (chunk) => {
            body += chunk
            if (body.length > 1e7) {
                res.writeHead(413, 'Request Entity Too Large', { 'Content-Type': 'text/html; charset=utf-8' })
                res.end('<!doctype html><html><head><title>413</title></head><body>413: Request Entity Too Large</body></html>')
                reject('413: Request Entity Too Large')
            }
        })
        req.on('end', () => {
            const data = qs.parse(body)
            resolve(data)
        })
    })
}

function getHtmlFromCode(code: 200 | 400 | 404) {
    const messages = {
        200: 'OK',
        400: 'Bad Request',
        404: 'Resource Not Found'
    }
    return `<!doctype html><html><head><title>${code}</title></head><body>${code}: ${messages[code]}</body></html>`
}

function check() {
    const now = new Date()
    const fixTwoDigits = (number: number) => number < 10 ? `0${number}` : number.toString()
    const toDate = (date: Date) => `${date.getFullYear()}-${fixTwoDigits(date.getMonth() + 1)}-${fixTwoDigits(date.getDate())}`
    if (lastUpdateTime && toDate(lastUpdateTime) === config.endDate && toDate(now) === config.endDate) {
        if (!freeze) {
            logger.info('MAIN', 'Freezed.')
            freeze = true
        }
    } else {
        if (freeze) {
            logger.info('MAIN', 'Started.')
            freeze = false
        }
    }
    if (!freeze) {
        if (!lastUpdateTime) {
            lastUpdateTime = now
            updateInfo()
        } else {
            if (now.getMinutes() % (config.interval / 60000) === 0 && now.getTime() - lastUpdateTime.getTime() >= config.interval - 5000) {
                updateInfo()
                lastUpdateTime = now
            }
        }
    }
}

async function updateInfo(toUpdateUserInfo = true) {
    updateTimeInfo = `更新于 ${getTime()}`
    if (toUpdateUserInfo) {
        logger.dbug(updateTimeInfo)
        await updateUserInfo()
    }
    sortRank()
    if (!lastUpdateTime) {
        lastUpdateTime = new Date()
    }
    sortedUsers.forEach(async v => {
        const day = getTime(false)
        if (history[day] === undefined) {
            // The first fetch of `day`.
            logger
                .info('RANK', `=== ${day} 00:00 ===`)
                .indent()
            for (const row of await getRankTable()) {
                logger.info('RANK', '| ' + row.join(' | ') + ' |')
            }
            logger.indent(-1)
            history[day] = {}
        }
        if (history[day][v.uid] === undefined) {
            history[day][v.uid] = v.heart
        }
    })
    writeConfig('history.json', history)
    if (!freeze) {
        rankTable = await getRankTableSvg()
        // increaseImage = await drawIncreaseImage()
        registrationBBCode = getRegistrationBBCode()
    }
    writeConfig('users.json', users)
}

async function updateUserInfo() {
    try {
        for (const uid in users) {
            const user = users[uid]
            if (!user.banned) {
                const userUpdated = await getUserFromUid(Number(uid), user)
                users[uid] = userUpdated
                await sleep(config.sleep)
            }
        }
    } catch (e) {
        logger.dbug(`Updating info error: '${e}'.`)
    }
}

function sortRank() {
    sortedUsers = []
    for (const uid in users) {
        const user = users[uid]
        if (!user.banned) {
            sortedUsers.push({ uid: parseInt(uid), heart: user.heartAttained, lastChanged: user.lastChanged })
        }
    }
    sortedUsers.sort((a: SortedUser, b: SortedUser) => a.heart === b.heart ? a.lastChanged - b.lastChanged : b.heart - a.heart)
}

function getTime(toMinutes = true) {
    const date = new Date()
    const addPreZero = (num: number) => num < 10 ? `0${num}` : num.toString()

    if (toMinutes) {
        return `${
            date.getFullYear()}年${
            addPreZero(date.getMonth() + 1)}月${
            addPreZero(date.getDate())}日 ${
            addPreZero(date.getHours())}:${
            addPreZero(date.getMinutes())}`
    } else {
        return `${
            date.getFullYear()}年${
            addPreZero(date.getMonth() + 1)}月${
            addPreZero(date.getDate())}日`
    }
}

const base64Map = new Map<string, string>()

async function getBase64FromUri(uri: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        if (base64Map.has(uri)) {
            resolve(base64Map.get(uri))
        }
        request.defaults({ encoding: null }).get(uri, (error, response, body) => {
            if (!error && response.statusCode == 200) {
                const base64 = `data:${response.headers['content-type']};base64,${Buffer.from(body).toString('base64')}`
                base64Map.set(uri, base64)
                resolve(base64)
            } else {
                reject({ error, statusCode: response.statusCode })
            }
        })
    })
}

async function getRankTable() {
    const table: Table = [
        ['段位', '用户名', '已获爱心']
    ]
    const remainingRanks: Rank[] = JSON.parse(JSON.stringify(ranks))
    for (const user of sortedUsers) {
        for (const rank of remainingRanks) {
            if (rank.amount > 0 && user.heart > rank.heart) {
                if (--rank.amount <= 0) {
                    remainingRanks.splice(remainingRanks.indexOf(rank), 1)
                }
                try {
                    table.push([rank.icon ? `<img src="${await getBase64FromUri(rank.icon)}" alt="${rank.name}" title="${rank.name}"></img>` : rank.name, users[user.uid].username, user.heart])
                } catch {
                    table.push([rank.name, users[user.uid].username, user.heart])
                }
                break
            } else {
                // It's impossible for users after this one to meet this rank's requirement.
                // Therefore, remove this rank.
                remainingRanks.splice(remainingRanks.indexOf(rank), 1)
            }
        }
    }

    return table
}

async function getRankTableSvg() {
    const width = 530
    const primaryBackColor = '#fcf1da'
    const titleBackColor = '#ffbf00'
    const primaryForeColor = '#000000'
    const grayForeColor = '#444444'
    const titleForeColor = '#FFFFFF'
    const timeColor = '#81157d'
    const css = `<style>
body {
    margin: 0;
}

table {
    width: ${width}px;
    border-collapse: collapse;
}

table, th, td {
    border-top: 1px solid ${titleBackColor};
    border-bottom: 1px solid ${titleBackColor};
}

th, td {
    padding: 2px;
    text-align: center;
    font-weight: bold;
}

th {
    background-color: ${titleBackColor};
    color: ${titleForeColor};
}

td {
    background-color: ${primaryBackColor};
    color: ${primaryForeColor};
}

td.gray {
    background-color: ${primaryBackColor};
    color: ${grayForeColor};
    font-weight: normal;
}

div.time {
    font-weight: bold;
    color: ${timeColor};
    text-align: center;
    width: 100%;
}

img {
    max-width: 1em;
    max-height: 1em;
}
</style>`
    const prefix = `<?xml version='1.0' standalone='no'?><!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'><svg width='${width}px' height='1000px' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'><foreignObject x="0" y="0" width="${width}px" height="1000px">${css}<body xmlns="http://www.w3.org/1999/xhtml">`
    const suffix = '</body></foreignObject></svg>'
    let body = '<p>暂停公示</p>'

    if (!stopShowingRankTable) {
        const tablePrefix = '<table>'
        const tableSuffix = '</table>'

        const table = await getRankTable()

        // Output table HTML.
        const rows: string[] = []
        for (let i = 0; i < table.length; i++) {
            const row = table[i]
            const rowPrefix = '<tr>'
            const rowSuffix = '</tr>'
            const cellPrefix = i === 0 ? '<th>' : `<td>`
            const cellSuffix = i === 0 ? '</th>' : '</td>'
            rows.push(`${rowPrefix}${cellPrefix}${row.join(`${cellSuffix}${cellPrefix}`)}${cellSuffix}${rowSuffix}`)
        }
        const tableHtml = rows.join('')

        // Get time HTML.
        const timeHtml = `<div class="time">${fakeUpdateTimeInfo || updateTimeInfo}</div>`

        body = `${tablePrefix}${tableHtml}${tableSuffix}${timeHtml}`
    }
    return `${prefix}${body}${suffix}`
}

function getRegistrationBBCode() {
    const table: Table = []
    let row: Row = [
        '[b]用户名[/b]', '[b]UID[/b]', '[color=Purple][b]爱心数量[/b][/color]',
        '[b]用户名[/b]', '[b]UID[/b]', '[color=Purple][b]爱心数量[/b][/color]'
    ]

    for (const uid in users) {
        const user = users[uid]

        if (row.length >= 6) {
            table.push(row)
            row = []
        }

        row = [...row, user.username, uid, user.heartInitial]
    }
    table.push(row)

    return getBBCodeOfTable(table)
}

async function addUser(uid: number, heartInitial?: number) {
    try {
        const user = await getUserFromUid(uid)

        if (heartInitial !== undefined) {
            user.heartInitial = heartInitial
            user.heartAttained = user.heartPresent - user.heartInitial - user.heartAbandoned
        }
        logger.info('User', `+ ${uid}: ${JSON.stringify(user)}.`)

        users[uid] = user
        updateInfo(false)
    } catch (_) {
        return false
    }
    return true
}

function delUser(uid: number) {
    if (users[uid] !== undefined) {
        logger.info('User', `- ${uid}: ${JSON.stringify(users[uid])}.`)
        delete users[uid]
        updateInfo(false)
    }
}

function editUser(uid: number, heartInitial: number,
    heartAbandoned: number, banned: boolean) {
    const user = users[uid]
    const oldUser = JSON.parse(JSON.stringify(user))
    user.heartInitial = heartInitial
    user.heartAbandoned = heartAbandoned
    user.banned = banned
    user.heartAttained = user.heartPresent - user.heartInitial - user.heartAbandoned
    const { diffBefore, diffAfter } = getDifference(oldUser, user)
    logger.info('User', `- ${uid}: ${JSON.stringify(diffBefore)}.`)
    logger.info('User', `+ ${uid}: ${JSON.stringify(diffAfter)}.`)
    updateInfo(false)
}
