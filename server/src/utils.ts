import * as fs from 'fs-extra'
import * as path from 'path'

export interface Config {
    password: string,
    interval: number,
    sleep: number,
    port: number,
    host: string,
    protocol: string,
    minimumHeart: number,
    minimumHeartFirstPlace: number,
    keyFile?: string,
    certFile?: string
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

export interface History {
    [time: string]: {
        [uid: string]: number
    }
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

/**
 * Write config to JSON file.
 * @param fileName Configuration file name. e.g. `config.json`
 * @param content The config object.
 */
export async function writeConfig<T extends object>(fileName: string, content: T) {
    const filePath = path.join(__dirname, fileName)

    fs.writeJson(filePath, content, { spaces: 4 })
}

function getStringBetweenStrings(input: string, start: string, end: string) {
    if (input.indexOf(start) !== -1 && input.indexOf(end) !== -1) {
        return input.slice(input.indexOf(start) + start.length, input.indexOf(end))
    } else {
        throw `Failed to fine string between '${start}' and '${end}' in '${input}'.`
    }
}

export function getUserViaWebCode(webCode: string, oldUser?: User): User {
    try {
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

        const { banned, heartAbandoned, heartAbandonedLinks, heartInitial } = oldUser

        return {
            username,
            heartInitial,
            heartAbandoned,
            heartAbandonedLinks,
            heartPresent,
            heartAttained: heartPresent - heartInitial - heartAbandoned,
            banned
        }
    } catch {
        throw 'Invalid user page.'
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

export function sleep(ms: number) {
    return new Promise<void>(resolve => {
        setTimeout(resolve, ms)
    })
}

export function drawBar(ctx: CanvasRenderingContext2D, upperLeftCornerX: number,
    upperLeftCornerY: number, width: number, height: number, color: string | CanvasGradient | CanvasPattern) {
    ctx.save()
    ctx.fillStyle = color
    ctx.fillRect(upperLeftCornerX, upperLeftCornerY, width, height)
    ctx.restore()
}
