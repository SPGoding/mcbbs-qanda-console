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
    getBBCodeOfTable, Table, Row, sleep, drawBar
} from './utils'

let config: Config = {
    password: '', interval: NaN, port: NaN, host: '', protocol: 'http',
    minimumHeart: NaN, minimumHeartFirstPlace: NaN, sleep: NaN
}
let users: Users = {}
let history: History = {}
let rank: RankElement[]

let rankImage: Buffer
let updateTimeInfo = ''
let registrationBBCode = ''
let increaseImage: Buffer
let heartImage: Buffer

let lastUpdateTime: Date

// /**
//  * 奖励
//  */
// const rewards = [
//     [10, 10, 3, 2],
//     [7, 7, 2, 1],
//     [5, 5, 1, 0],
//     [3, 3, 1, 0],
//     [3, 3, 1, 0],
//     [3, 3, 1, 0],
//     [3, 3, 1, 0],
//     [3, 3, 1, 0],
//     [3, 3, 1, 0],
//     [3, 3, 1, 0]
// ]
// /**
//  * 每增加一贡献所需爱心
//  */
// const ctbHeart = 50

let stopShowingRankImage = false

async function requestListener(req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.method === 'GET') {
        if (req.url && req.url.split('?')[0] === '/api/get-rank-image') {
            res.writeHead(200, { 'Content-Type': 'image/png' })
            res.end(rankImage)
        } else if (req.url && req.url.split('?')[0] === '/api/get-increase-image') {
            res.writeHead(200, { 'Content-Type': 'image/png' })
            res.end(increaseImage)
        } else if (req.url && req.url.split('?')[0] === '/api/get-heart-image') {
            res.writeHead(200, { 'Content-Type': 'image/png' })
            res.end(heartImage)
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
        } else if (req.url === '/favicon.ico') {
            const filePath = path.join(__dirname, '../../client/favicon.ico')
            res.writeHead(200, { 'Content-Type': 'image/x-icon' })
            res.end(await fs.readFile(filePath))
        } else {
            const filePath = path.join(__dirname, '../../client', 'index.min.html')
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
                    console.error(e.message)
                })
        } else {
            http
                .createServer(requestListener)
                .listen(config.port)
                .on('error', e => {
                    console.error(e.message)
                })
        }

        await updateInfo()

        console.log(`Server is running at ${config.protocol}://${config.host}:${config.port}.`)
    } catch (e) {
        console.error(e)
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
                    console.error('Inconsistent input.')
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
    console.log(updateTimeInfo)
    if (toUpdateUserInfo) {
        await updateUserInfo()
    }
    sortRank()
    if (!lastUpdateTime) {
        lastUpdateTime = new Date()
    }
    rank.forEach(v => {
        const day = getTime(false)
        if (!history[day]) {
            history[day] = {}
        }
        if (!history[day][v.uid]) {
            history[day][v.uid] = v.heart
        }
    })
    writeConfig('history.json', history)
    rankImage = await drawRankImage()
    increaseImage = await drawIncreaseImage()
    heartImage = await drawHeartImage()
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
        console.error(`Updating info error: '${e}'.`)
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
            // // 显示奖励
            // let reward = [0, 0, 0, 0]
            // // 各名次基础奖励
            // if (row[2] >= heartMin[i]) {
            //     reward = rewards[i]
            // }
            // // 拓展贡献奖励
            // if (row[2] >= 100) {
            //     const ctb = Number(row[2]) % ctbHeart - 1
            //     reward[3] += ctb
            // }
            // row.push(`${reward[0]} | ${reward[1]} | ${reward[2]} | ${reward[3]}`)
        }

        const canvas = new Canvas(554, 260)
        const ctx = canvas.getContext('2d')
        const img = await loadImage(path.join(__dirname, '../img/table.png'))
        ctx.drawImage(img, 0, 0)

        const fontHeight = 20
        const rowHeight = 21
        const columnLeftMargins = [0, 94, 94 + 310]
        const columnWidths = [94, 310, 145]
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
        const canvas = new Canvas(554, 260)
        const ctx = canvas.getContext('2d')
        const img = await loadImage(path.join(__dirname, '../img/static-table.png'))
        ctx.drawImage(img, 0, 0)
        return canvas.toBuffer('image/png')
    }
}

async function drawIncreaseImage() {
    const colors = [
        '#2db7fc',
        '#fcda2d',
        '#732dfc',
        '#4ffc2d',
        '#fc2db7',
        '#fcda2d',
        '#fc732d',
        '#2d4ffc',
        '#00787e',
        '#7e0078'
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
            fontHeight)
        ctx.fillText(username.slice(0, 3),
            i * barWidth + barWidth / 2 - ctx.measureText(username.slice(0, 3)).width / 2,
            canvas.height - fontHeight * 2)
        i++
    }
    ctx.fillStyle = '#81157d'
    ctx.fillText(getTime(false),
        (canvas.width - ctx.measureText(getTime(false)).width) / 2,
        canvas.height - fontHeight * 0.5)

    return canvas.toBuffer('image/png')
}

async function drawHeartImage() {
    const fontHeight = 16
    const canvas = new Canvas(500, 400)
    const usernameRegionWidth = 100
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    const pointMaxY = canvas.height - fontHeight * 3
    const pointSpace = (canvas.width - usernameRegionWidth) / 11
    const data = rank.map(v => {
        const ans: number[] = []
        for (const day in history) {
            if (history[day] && history[day][v.uid]) {
                ans.push(history[day][v.uid])
            }
        }
        return { username: users[v.uid].username, hearts: ans.slice(-7) }
    })
    ctx.font = `${fontHeight}px Microsoft Yahei`
    let heartMax = 0
    for (const { hearts } of data) {
        for (const heart of hearts) {
            heartMax = Math.max(heartMax, heart)
        }
    }
    let i = 0
    let { r, g, b } = { r: 0, g: 0, b: 0 }
    for (const { username, hearts } of data) {
        b += 63
        if (b > 255) {
            g += 63
            b = 0
        }
        if (g > 255) {
            r += 63
            g = 0
        }
        const addPreZero = (num: number) => num.toString(16).length < 2 ? `0${num.toString(16)}` : num.toString(16)
        ctx.strokeStyle = ctx.fillStyle =
            `#${addPreZero(r)}${addPreZero(g)}${addPreZero(b)}`
        const points: number[][] = []
        let j = 0
        for (const heart of hearts) {
            const pointX = (j + 0.5) * pointSpace
            const pointY = pointMaxY - pointMaxY * heart / heartMax + fontHeight * 1.5
            const point = [pointX, pointY]
            points.push(point)
            ctx.fillText(heart.toString(),
                pointX - ctx.measureText(heart.toString()).width / 2, pointY + fontHeight)
            j++
        }
        ctx.beginPath()
        if (points[0]) {
            ctx.moveTo(points[0][0], points[0][1])
            for (const point of points) {
                ctx.lineTo(point[0], point[1])
            }
        }
        ctx.stroke()
        ctx.fillText(username,
            canvas.width - usernameRegionWidth / 2 - ctx.measureText(username).width / 2,
            (i + 1.5) * fontHeight)
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

        users[uid] = user
        updateInfo(false)
    } catch (_) {
        return false
    }
    return true
}

function delUser(uid: number) {
    delete users[uid]
    updateInfo(false)
}

function editUser(uid: number, heartInitial: number,
    heartAbandoned: number, banned: boolean) {
    const user = users[uid]
    user.heartInitial = heartInitial
    user.heartAbandoned = heartAbandoned
    user.banned = banned
    user.heartAttained = user.heartPresent - user.heartInitial - user.heartAbandoned
    updateInfo(false)
}
