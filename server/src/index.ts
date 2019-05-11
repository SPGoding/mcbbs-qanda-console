import * as rp from 'request-promise-native'
import * as http from 'http'
import * as path from 'path'
import { Canvas, loadImage } from 'canvas'
import { loadConfig, Config, Users, RankElement, getUserViaWebCode, writeConfig, getBBCodeOfTable, Table, Row } from './utils'

let config: Config = { password: '', interal: NaN, port: NaN }
let users: Users = {}
let rank: RankElement[]

let rankImage: Buffer
let rankTime = ''
let registrationBBCode = ''
let abandonedHeartBBCode = ''

async function startup() {
    config = await loadConfig<Config>('config.json', { password: '', interal: 600000, port: 80 })
    users = await loadConfig<Users>('users.json', {})

    await updateInfo()
    setInterval(updateInfo, config.interal)

    http
        .createServer(async (req, res) => {
            if (req.method === 'GET') {
                if (req.url === '/rank') {
                    res.writeHead(200, { 'Content-Type': 'image/png' })
                    res.end(rankImage)
                } else if (req.url === '/registration-bbcode') {
                    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
                    res.end(registrationBBCode)
                } else if (req.url === '/abandoned-heart-bbcode') {
                    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
                    res.end(abandonedHeartBBCode)
                } else {
                    res.writeHead(404, 'Resource Not Found', { 'Content-Type': 'text/html; charset=utf-8' })
                    res.end('<!doctype html><html><head><title>404</title></head><body>404: Resource Not Found</body></html>')
                }
            } else if (req.method === 'POST') {
                if (req.url === '/add-user') {
                    res.setHeader('Content-Type', "text/html")
                } else if (req.url === '/del-user') {
                    res.setHeader('Content-Type', "text/html")
                } else if (req.url === '/edit-user') {
                    res.setHeader('Content-Type', "text/html")
                } else {
                    res.writeHead(404, 'Resource Not Found', { 'Content-Type': 'text/html' })
                    res.end('<!doctype html><html><head><title>404</title></head><body>404: Resource Not Found</body></html>')
                }
            }
        })
        .listen(config.port)
        .on('error', e => {
            console.error(e.message)
        })
    console.log(`Server is running at localhost:${config.port}.`)
}

setImmediate(startup)

async function updateInfo() {
    await updateUserInfo()
    updateRankInfo()
    rankImage = await drawRankTable()
    registrationBBCode = getRegistrationBBCode()
    abandonedHeartBBCode = getAbandonedHeartBBCode()
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
    writeConfig('users.json', users)
}

function updateRankInfo() {
    rank = []
    for (const uid in users) {
        const user = users[uid]
        rank.push({ uid: parseInt(uid), heart: user.heartAttained })
    }
    rank.sort((a: RankElement, b: RankElement) => b.heart - a.heart)
    rankTime = new Date().toLocaleString()
}

async function drawRankTable() {
    const table: Table = []
    for (const ele of rank.slice(0, 10)) {
        const row = [rank.indexOf(ele) + 1, users[ele.uid].username, ele.heart]
        table.push(row)
    }

    const canvas = new Canvas(554, 260)
    const ctx = canvas.getContext('2d')
    const img = await loadImage(path.join(__dirname, '../img/table.png'))
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)

    const fontHeight = 20
    const rowHeight = 21
    const columnWidthes = [0, 94, 94 + 312]
    const padding = 4
    ctx.font = `${fontHeight}px Microsoft Yahei`

    let rowNumber = 1
    for (const row of table) {
        let columnNumber = 0
        for (const cell of row) {
            ctx.fillText(cell.toString(), padding + columnWidthes[columnNumber], rowNumber * rowHeight + fontHeight)
            columnNumber++
        }
        rowNumber++
    }
    ctx.fillText(rankTime, canvas.width / 2 - ctx.measureText(rankTime).width / 2, canvas.height - padding)

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
}

function delUser(uid: number) {
    delete users[uid]
}

function editUser(uid: number, heartInitial: number,
    heartAbandoned: number, heartAbandonedLinks: string[], banned: boolean) {
    const user = users[uid]
    user.heartInitial = heartInitial
    user.heartAbandoned = heartAbandoned
    user.heartAbandonedLinks = heartAbandonedLinks
    user.banned = banned
}
