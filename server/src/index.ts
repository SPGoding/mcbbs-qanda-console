import * as rp from 'request-promise-native'
import * as http from 'http'
import * as https from 'https'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as qs from 'querystring'
import * as md5 from 'md5'
import * as read from 'read'
import { Canvas, loadImage } from 'canvas'
import {
    History, Users, loadConfig, Config, RankElement, getUserViaWebCode, writeConfig,
    getBBCodeOfTable, Table, Row, sleep, drawBar, Counter, Logger
} from './utils'

const logger = new Logger()

let config: Config = {
    password: '', interval: NaN, port: NaN, host: '', protocol: 'http',
    minimumHeart: NaN, minimumHeartFirstPlace: NaN, sleep: NaN
}
let users: Users = {}
let history: History = {}
let rank: RankElement[]
let counter: Counter = {}

let rankImage: Buffer
let updateTimeInfo = ''
let registrationBBCode = ''
let increaseImage: Buffer

let lastUpdateTime: Date

let stopShowingRankImage = false

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
            res.writeHead(200, { 'Content-Type': 'image/png' })
            res.end(rankImage)
        } else if (req.url && req.url.split('?')[0] === '/api/get-increase-image') {
            res.writeHead(200, { 'Content-Type': 'image/png' })
            res.end(increaseImage)
        } else if (req.url === '/api/get-registration-bbcode') {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end(registrationBBCode)
        } else if (req.url === '/api/get-users') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(users))
        } else if (req.url === '/api/get-consts') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({
                minimumHeart: config.minimumHeart, minimumHeartFirstPlace: config.minimumHeartFirstPlace,
                interval: config.interval, sleep: config.sleep
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
        if (req.url !== '/api/add-user' && req.url !== '/api/del-user' && req.url !== '/api/edit-user'
            && req.url !== '/api/login' && req.url !== '/api/toggle-showing-rank-image'
            && req.url !== '/api/edit-consts') {
            res.writeHead(404, 'Resource Not Found', { 'Content-Type': 'text/html' })
            res.end(getHtmlFromCode(404))
            return
        }
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
                stopShowingRankImage = !stopShowingRankImage
                rankImage = await drawRankImage()
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
                if (data.minimumHeart && data.minimumHeartFirstPlace) {
                    config.minimumHeart = parseInt(data.minimumHeart as string)
                    config.minimumHeartFirstPlace = parseInt(data.minimumHeartFirstPlace as string)
                    await writeConfig<Config>('config.json', config)
                    rankImage = await drawRankImage()
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
        }
    }
}

async function startup() {
    try {
        config = await loadConfig<Config>('config.json',
            {
                password: '', sleep: 500, interval: 600000, port: 80, host: '',
                protocol: 'http', minimumHeart: 30, minimumHeartFirstPlace: 100
            })
        users = await loadConfig<Users>('users.json', {})
        history = await loadConfig<History>('history.json', {})
        counter = await loadConfig<Counter>('counter.json', {})

        if (config.password === '') {
            await setPassword()
        }

        setInterval(check, 15000)

        if (config.protocol === 'https' && config.keyFile && config.certFile) {
            https
                .createServer({
                    key: fs.readFileSync(config.keyFile),
                    cert: fs.readFileSync(config.certFile)
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
    if (!lastUpdateTime) {
        lastUpdateTime = new Date()
        updateInfo()
    } else {
        const now = new Date()
        if (now.getMinutes() % (config.interval / 60000) === 0 && now.getTime() - lastUpdateTime.getTime() >= config.interval - 5000) {
            updateInfo()
            lastUpdateTime = now
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
    rank.forEach(v => {
        const day = getTime(false)
        if (history[day] === undefined) {
            history[day] = {}
        }
        if (history[day][v.uid] === undefined) {
            history[day][v.uid] = v.heart
        }
    })
    writeConfig('history.json', history)
    rankImage = await drawRankImage()
    increaseImage = await drawIncreaseImage()
    registrationBBCode = getRegistrationBBCode()
    writeConfig('users.json', users)
}

async function updateUserInfo() {
    try {
        for (const uid in users) {
            const user = users[uid]
            if (!user.banned) {
                const url = `http://www.mcbbs.net/?${uid}`
                const webCode: string = await rp(url)
                const userUpdated = getUserViaWebCode(webCode, user)
                users[uid] = userUpdated
                await sleep(config.sleep)
            }
        }
    } catch (e) {
        logger.eror(`Updating info error: '${e}'.`)
    }
}

function sortRank() {
    rank = []
    for (const uid in users) {
        const user = users[uid]
        if (!user.banned) {
            rank.push({ uid: parseInt(uid), heart: user.heartAttained })
        }
    }
    rank.sort((a: RankElement, b: RankElement) => b.heart - a.heart)
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

async function drawRankImage() {
    if (!stopShowingRankImage) {
        const table: Table = []
        // 初步制作表格
        for (const ele of rank.slice(0, 10)) {
            const row = [rank.indexOf(ele) + 1, users[ele.uid].username, ele.heart]
            table.push(row)
        }
        // 细致化表格内容
        for (let i = 0; i < table.length; i++) {
            const row = table[i]
            if (i >= 1) {
                const lastRow = table[i - 1]
                // 处理并列排名
                if (row[2] === lastRow[2]) {
                    row[0] = lastRow[0]
                }
            }
        }

        const canvas = new Canvas(530, 260)
        const ctx = canvas.getContext('2d')
        const img = await loadImage(path.join(__dirname, '../img/table.png'))
        ctx.drawImage(img, 0, 0)

        const fontHeight = 20
        const rowHeight = 21
        const columnLeftMargins = [0, 94, 94 + 296]
        const columnWidths = [94, 296, 138]
        ctx.font = `${fontHeight}px Microsoft Yahei`
        ctx.fillStyle = '#000000'

        let rowNumber = 1
        for (const row of table) {
            let cellNumber = 0
            let heartColor = '#000000'
            let otherColor = '#000000'
            if (config.minimumHeart !== -1 && row[2] < config.minimumHeart) {
                otherColor = '#666666'
                heartColor = '#666666'
            }
            if (config.minimumHeartFirstPlace !== -1 && row[0] === 1 && row[2] >= config.minimumHeartFirstPlace) {
                heartColor = '#ff0000'
            }
            for (const cell of row) {
                if (cellNumber === 2) {
                    ctx.fillStyle = heartColor
                } else {
                    ctx.fillStyle = otherColor
                }
                ctx.fillText(cell.toString(),
                    columnLeftMargins[cellNumber] + (columnWidths[cellNumber] - ctx.measureText(cell.toString()).width) / 2,
                    rowNumber * rowHeight + fontHeight)
                cellNumber++
            }
            rowNumber++
        }
        ctx.fillStyle = '#81157d'
        ctx.fillText(updateTimeInfo, canvas.width / 2 - ctx.measureText(updateTimeInfo).width / 2, canvas.height - 4)

        return canvas.toBuffer('image/png')
    } else {
        const canvas = new Canvas(530, 260)
        const ctx = canvas.getContext('2d')
        const img = await loadImage(path.join(__dirname, '../img/static-table.png'))
        ctx.drawImage(img, 0, 0)
        return canvas.toBuffer('image/png')
    }
}

async function drawIncreaseImage() {
    const colors = [
        '#48b2bf',
        '#bf4847',
        '#5448bf',
        '#48bf91',
        '#b3bf48',
        '#9048bf',
        '#bf5448',
        '#77bf48',
        '#4877bf',
        '#bf9048'
    ]
    const fontHeight = 16
    const canvas = new Canvas(400, 432)
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    const barMaxHeight = canvas.height - fontHeight * 4.5
    const barWidth = canvas.width / 10
    const data = rank.map(v => {
        return { username: users[v.uid].username, delta: v.heart - history[getTime(false)][v.uid] }
    })
    ctx.font = `${fontHeight}px Microsoft Yahei`
    let deltaMax = 0
    for (const { delta } of data) {
        deltaMax = Math.max(deltaMax, delta)
    }
    let i = 0
    for (const { username, delta } of data) {
        if (i >= 10) {
            break
        }
        // Drawing bars
        const barHeight = barMaxHeight * delta / deltaMax
        ctx.fillStyle = colors[i]
        drawBar(ctx, i * barWidth, barMaxHeight - barHeight + fontHeight * 1.5, barWidth, barHeight, colors[i])
        ctx.fillText(delta.toString(),
            i * barWidth + barWidth / 2 - ctx.measureText(delta.toString()).width / 2,
            barMaxHeight - barHeight + fontHeight * 1.3)
        let un = username.slice(0, 4)
        while (ctx.measureText(un).width > barWidth) {
            un = un.slice(0, -1)
        }
        ctx.fillStyle = '#000000'
        ctx.fillText(un, i * barWidth + barWidth / 2 - ctx.measureText(un).width / 2,
            canvas.height - fontHeight * 2)
        i++
    }
    ctx.fillStyle = '#81157d'
    ctx.fillText(getTime(false),
        (canvas.width - ctx.measureText(getTime(false)).width) / 2,
        canvas.height - fontHeight * 0.5)

    return canvas.toBuffer('image/png')
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
        const url = `http://www.mcbbs.net/?${uid}`
        const webCode: string = await rp(url)
        const user = getUserViaWebCode(webCode)

        if (heartInitial !== undefined) {
            user.heartInitial = heartInitial
            user.heartAttained = user.heartPresent - user.heartInitial - user.heartAbandoned
        }

        logger.info(`+ ${uid}: ${JSON.stringify(user)}.`)

        users[uid] = user
        updateInfo(false)
    } catch (_) {
        return false
    }
    return true
}

function delUser(uid: number) {
    logger.info(`- ${uid}: ${JSON.stringify(users[uid])}.`)
    delete users[uid]
    updateInfo(false)
}

function editUser(uid: number, heartInitial: number,
    heartAbandoned: number, banned: boolean) {
    const user = users[uid]
    logger.info(`- ${uid}: ${JSON.stringify(user)}`)
    user.heartInitial = heartInitial
    user.heartAbandoned = heartAbandoned
    user.banned = banned
    user.heartAttained = user.heartPresent - user.heartInitial - user.heartAbandoned
    logger.info(`+ ${uid}: ${JSON.stringify(user)}`)
    updateInfo(false)
}
