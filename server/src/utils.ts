import * as fs from 'fs-extra'
import * as path from 'path'

export interface Config {
    password: string,
    interal: number,
    port: number,
    host: string,
    protocol: string
}

export interface User {
    username: string,
    heartInitial: number,
    heartAbandoned: number,
    heartAbandonedLinks: string[],
    heartPresent: number,
    heartAttained: number,
    banned: boolean
}

export interface Users {
    [uid: number]: User
}

export interface RankElement {
    uid: number,
    heart: number
}

export type Table = Row[]
export type Row = (string | number)[]

export async function loadConfig<T>(fileName: string, def?: T): Promise<T> {
    const filePath = path.join(__dirname, fileName)

    if (!await fs.pathExists(filePath)) {
        fs.writeJson(filePath, def)
    }

    const config = fs.readJson(filePath, { encoding: 'utf8' })

    return config
}

export async function writeConfig<T extends object>(fileName: string, content: T) {
    const filePath = path.join(__dirname, fileName)

    fs.writeJson(filePath, content)
}

function getStringBetweenStrings(input: string, start: string, end: string) {
    return input.slice(input.indexOf(start) + start.length, input.indexOf(end))
}

export function getUserViaWebCode(webCode: string, oldUser?: User): User {
    const username = getStringBetweenStrings(webCode, '<title>', '的个人资料 -  Minecraft(我的世界)中文论坛 - </title>')
    const heartPresent = parseInt(getStringBetweenStrings(webCode, '<li><em>爱心</em>', ' 心</li>'))

    if (!oldUser) {
        oldUser = {
            banned: false,
            heartAbandoned: 0,
            heartAbandonedLinks: [],
            heartInitial: heartPresent,
            heartAttained: NaN, // Won't be inherited.
            heartPresent: NaN, // Won't be inherited.
            username: '' // Won't be inherited.
        }
    }

    let { banned, heartAbandoned, heartAbandonedLinks, heartInitial } = oldUser

    return {
        username,
        heartInitial,
        heartAbandoned,
        heartAbandonedLinks,
        heartPresent,
        heartAttained: heartPresent - heartInitial - heartAbandoned,
        banned
    }
}

export function getBBCodeOfTable(table: Table) {
    const tablePrefix = '[align=center][table=540,white]'
    const tableSuffix = '[/table][/align]'
    const rowPrefix = '[tr]'
    const rowSuffix = '[/tr]'
    const dataPrefix = '[td]'
    const dataSuffix = '[/td]'

    let ans = `${tablePrefix}\n`
    for (const row of table) {
        ans += rowPrefix
        for (const element of row) {
            ans += `${dataPrefix}${element}${dataSuffix}`
        }
        ans += `${rowSuffix}\n`
    }
    ans += tableSuffix
    return ans
}
