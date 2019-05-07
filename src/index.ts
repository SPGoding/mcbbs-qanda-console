import * as rp from 'request-promise-native'
import * as http from 'http'
import { loadConfig, Config, Users, RankElement, getUserViaWebCode, writeConfig, getBBCodeOfTable, Table, Row } from './utils'

let config: Config = { password: '', interal: NaN, port: NaN }
let users: Users = {}
let rank: RankElement[]

let rankBBCode = ''
let rankTime = ''
let registrationBBCode = ''
let abandonedHeartBBCode = '';

(async function startup() {
    config = await loadConfig<Config>('config.json', { password: '', interal: 600000, port: 80 })
    users = await loadConfig<Users>('users.json', {})

    await updateInfo()
    setInterval(updateInfo, config.interal)

    http
        .createServer(async (req, res) => {
            if (req.url) {
                res.setHeader('Content-Type', "image/png")
                let html = '233'
                res.end(html)
            }
        })
        .listen(config.port)
        .on('error', e => {
            console.error(e.message)
        })
})()


async function updateInfo() {
    await updateUserInfo()
    updateRankInfo()
    rankBBCode = drawRankTable()
    registrationBBCode = getRegistrationBBCode()
    abandonedHeartBBCode = getAbandonedHeartBBCode()
    console.log(rankBBCode)
    console.log(registrationBBCode)
    console.log(abandonedHeartBBCode)
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
        rank.push({ uid: parseInt(uid), heart: user.heartPresent })
    }
    rank.sort((a: RankElement, b: RankElement) => a.heart - b.heart)
    rankTime = new Date().toLocaleString()
}

function drawRankTable() {
    const table: Table = [
        ['[b]排名[/b]', '[b]用户名[/b]', '[b]当前获取爱心[/b]']
    ]
    let row: Row = []

    for (const ele of rank.slice(0, 10)) {
        row.push(rank.indexOf(ele) + 1, users[ele.uid].username, ele.heart)
    }

    return getBBCodeOfTable(table)
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
