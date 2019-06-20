import * as rp from 'request-promise-native'
import * as http from 'http'
import * as https from 'https'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as qs from 'querystring'
import * as md5 from 'md5'
import * as read from 'read'
import { Canvas, loadImage } from 'canvas'
import { Users, loadConfig, Config, RankElement, getUserViaWebCode, writeConfig, getBBCodeOfTable, Table, Row } from './utils'

let config: Config = { password: '', interal: NaN, port: NaN, host: '', protocol: 'http' }
let users: Users = {}
let rank: RankElement[]

let rankImage: Buffer
let rankTime = ''
let registrationBBCode = ''
let abandonedHeartBBCode = ''

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
/**
 * 获取奖励最低爱心
 */
const heartMin = [
    50, 20, 20, 20, 20, 20, 20, 20, 20, 20
]

async function startup() {
    try {
        config = await loadConfig<Config>('config.json', { password: '', interal: 600000, port: 80, host: '', protocol: 'http' })
        users = await loadConfig<Users>('users.json', {})

        if (config.password === '') {
            await setPassword()
        }

        await updateInfo()
        setInterval(check, 500)

        const requestListener = async (req: http.IncomingMessage, res: http.ServerResponse) => {
            if (req.method === 'GET') {
                if (req.url === '/api/get-rank-image') {
                    res.writeHead(200, { 'Content-Type': 'image/png' })
                    res.end(rankImage)
                } else if (req.url === '/api/get-registration-bbcode') {
                    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
                    res.end(registrationBBCode)
                } else if (req.url === '/api/get-abandoned-hearts-bbcode') {
                    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
                    res.end(abandonedHeartBBCode)
                } else if (req.url === '/api/get-users') {
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
                    res.end(JSON.stringify(users))
                } else if (req.url === '/favicon.ico') {
                    const filePath = path.join(__dirname, '../../client/dist/mcbbs-qanda-console-client/favicon.ico')
                    res.writeHead(200, { 'Content-Type': 'image/x-icon' })
                    res.end(await fs.readFile(filePath))
                } else {
                    const filePath = path.join(__dirname, '../../client/dist/mcbbs-qanda-console-client',
                        req.url && req.url !== '/' ? req.url : 'index.html')
                    const subType: string = {
                        css: 'css',
                        html: 'html',
                        js: 'javascript',
                        txt: 'plain'
                    }[filePath.slice(filePath.lastIndexOf('.') + 1)]
                    if (await fs.pathExists(filePath)) {
                        let content = await fs.readFile(filePath, 'utf8')
                        content = content.replace(/%\{serverUrl}%/g, `${config.protocol}://${config.host}:${config.port}`)
                        res.writeHead(200, { 'Content-Type': `text/${subType}; charset=utf-8` })
                        res.end(content)
                    } else {
                        res.writeHead(404, 'Resource Not Found', { 'Content-Type': 'text/html; charset=utf-8' })
                        res.end(getHtmlFromCode(404))
                    }
                }
            } else if (req.method === 'POST') {
                if (req.url !== '/api/add-user' && req.url !== '/api/del-user' && req.url !== '/api/edit-user' && req.url !== '/api/login') {
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
                        if (data.heartInitial !== undefined) {
                            await addUser(parseInt(data.uid as string), parseInt(data.heartInitial as string))
                        } else {
                            await addUser(parseInt(data.uid as string))
                        }
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
                        res.end(getHtmlFromCode(200))
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
                    if (data.uid !== undefined && data.heartInitial !== undefined && data.heartAbandoned !== undefined && data.banned !== undefined) {
                        editUser(
                            parseInt(data.uid as string),
                            parseInt(data.heartInitial as string),
                            parseInt(data.heartAbandoned as string),
                            (data.heartAbandonedLinks as string).split(/,/g),
                            data.banned === 'true'
                        )
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
                }
            }
        }

        if (config.keyFile && config.certFile) {
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

        console.log(`Server is running at ${config.protocol}://${config.host}:${config.port}.`)
    } catch (e) {
        console.error(e)
    }
}

setImmediate(startup)

async function setPassword() {
    return new Promise<void>((resolve, reject) => {
        read({ prompt: "Password: ", silent: true }, async (_, pass) => {
            read({ prompt: "Password again: ", silent: true }, async (_, pass2) => {
                if (pass === pass2) {
                    config.password = md5(md5(pass))
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
        if (now.getMinutes() % 10 === 0 && now.getTime() - lastUpdateTime.getTime() >= config.interal) {
            updateInfo()
            lastUpdateTime = now
        }
    }
}

async function updateInfo(toUpdateUserInfo = true) {
    rankTime = `统计于 ${getTime()}`
    console.log(rankTime)
    if (toUpdateUserInfo) {
        await updateUserInfo()
    }
    updateRankInfo()
    rankImage = await drawRankTable()
    registrationBBCode = getRegistrationBBCode()
    abandonedHeartBBCode = getAbandonedHeartBBCode()
    writeConfig('users.json', users)
}

async function updateUserInfo() {
    for (const uid in users) {
        try {
            const user = users[uid]
            if (!user.banned) {
                const url = `http://www.mcbbs.net/?${uid}`
                const webCode: string = await rp(url)
                const userUpdated = getUserViaWebCode(webCode, user)
                users[uid] = userUpdated
            }
        } catch (e) {
            console.error(`Updating info error: '${e}'.`)
        }
    }
}

function updateRankInfo() {
    rank = []
    for (const uid in users) {
        const user = users[uid]
        if (!user.banned) {
            rank.push({ uid: parseInt(uid), heart: user.heartAttained })
        }
    }
    rank.sort((a: RankElement, b: RankElement) => b.heart - a.heart)
}

function getTime() {
    const date = new Date()
    const addPreZero = (num: number) => num < 10 ? `0${num}` : num.toString()

    return `${
        date.getFullYear()}年${
        addPreZero(date.getMonth() + 1)}月${
        addPreZero(date.getDate())}日 ${
        addPreZero(date.getHours())}:${
        addPreZero(date.getMinutes())}`
}

async function drawRankTable() {
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
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)

    const fontHeight = 20
    const rowHeight = 21
    const columnLeftMargins = [0, 94, 94 + 310]
    const columnWidths = [94, 310, 145]
    ctx.font = `${fontHeight}px Microsoft Yahei`
    ctx.fillStyle = '#000000'

    let rowNumber = 1
    for (const row of table) {
        let columnNumber = 0
        for (const cell of row) {
            ctx.fillText(cell.toString(),
                columnLeftMargins[columnNumber] + (columnWidths[columnNumber] - ctx.measureText(cell.toString()).width) / 2,
                rowNumber * rowHeight + fontHeight)
            columnNumber++
        }
        rowNumber++
    }
    ctx.fillStyle = '#81157d'
    ctx.fillText(rankTime, canvas.width / 2 - ctx.measureText(rankTime).width / 2, canvas.height - 4)

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

function getAbandonedHeartBBCode() {
    const table: Table = [
        ['[b]用户名[/b]', '[b]UID[/b]', '[color=Red][b]放弃数量[/b][/color]', '[b]相关链接[/b]']
    ]
    let row: Row = []

    for (const uid in users) {
        const user = users[uid]
        if (user.heartAbandoned) {
            row = [
                user.username, uid, user.heartAbandoned,
                user.heartAbandonedLinks.map(v => `[url=${v}]最佳申请帖[/url]`).join('\n')
            ]
            table.push(row)
        }
    }

    return getBBCodeOfTable(table)
}

async function addUser(uid: number, heartInitial?: number) {
    const url = `http://www.mcbbs.net/?${uid}`
    const webCode: string = await rp(url)
    const user = getUserViaWebCode(webCode)

    if (heartInitial !== undefined) {
        user.heartInitial = heartInitial
        user.heartAttained = user.heartPresent - user.heartInitial - user.heartAbandoned
    }

    users[uid] = user
    updateInfo(false)
}

function delUser(uid: number) {
    delete users[uid]
    updateInfo(false)
}

function editUser(uid: number, heartInitial: number,
    heartAbandoned: number, heartAbandonedLinks: string[], banned: boolean) {
    const user = users[uid]
    user.heartInitial = heartInitial
    user.heartAbandoned = heartAbandoned
    user.heartAbandonedLinks = heartAbandonedLinks
    user.banned = banned
    user.heartAttained = user.heartPresent - user.heartInitial - user.heartAbandoned
    updateInfo(false)
}
