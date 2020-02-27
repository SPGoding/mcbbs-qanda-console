import * as fs from 'fs-extra'
import * as path from 'path'
import rp = require('request-promise-native')

export interface Config {
    password: string,
    interval: number,
    sleep: number,
    port: number,
    host: string,
    ranks: Rank[]
    protocol: string,
    endDate: string,
    keyFile?: string,
    certFile?: string
}

export interface User {
    username: string,
    heartInitial: number,
    heartAbandoned: number,
    heartPresent: number,
    heartAttained: number,
    banned: boolean,
    lastChanged: number
}

export interface Users {
    [uid: number]: User
}

export interface Rank {
    /**
     * The name of the rank.
     */
    name: string,
    /**
     * A URI to the rank's icon.
     */
    icon?: string,
    /**
     * The amount of required hearts for this rank.
     */
    heart: number,
    /**
     * The amount of rewarded emeralds for this rank.
     */
    emerald: number,
    /**
     * The available amount of this rank.
     */
    amount: number
}

export interface SortedUser {
    uid: number,
    heart: number,
    lastChanged: number
}

export interface History {
    [time: string]: {
        [uid: string]: number
    }
}

export interface Counter {
    [time: string]: {
        view: number,
        ips: string[]
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

/**
 * A logger.
 */
export class Logger {
    private _indent = 0

    private _log(type: 'INFO' | 'WARN' | 'EROR' | 'DBUG', thread: string, ...msg: string[]) {
        const date = new Date()
        const fixTwoDigits = (number: number) => number < 10 ? `0${number}` : number.toString()
        const fixThreeDigits = (number: number) => number < 10 ? `00${number}` : number < 100 ? `0${number}` : number.toString()
        const time = `${date.getFullYear()}-${fixTwoDigits(date.getMonth() + 1)}-${fixTwoDigits(date.getDate())} ${
            fixTwoDigits(date.getHours())}:${fixTwoDigits(date.getMinutes())}:${
            fixTwoDigits(date.getSeconds())}:${fixThreeDigits(date.getMilliseconds())}`
        const fileName = `${date.getFullYear()}-${fixTwoDigits(date.getMonth() + 1)}`
        msg.forEach(v => {
            const m = `[${time}] [${thread.toUpperCase()}] [${type}] ${'  '.repeat(this._indent)}${v}`
            const logPath = path.join(__dirname, `logs/${fileName}.log`)
            if (!fs.pathExistsSync(path.dirname(logPath))) {
                fs.mkdirSync(path.dirname(logPath))
            }
            console.log(m)
            if (type !== 'DBUG') {
                fs.appendFileSync(logPath, `${m}\n`, { encoding: 'utf8' })
            }
        })
        return this
    }

    public indent(delta = 1) {
        this._indent += delta
        return this
    }

    /**
     * Log an information.
     * @param msg The message.
     */
    public info(thread: string, ...msg: string[]) {
        return this._log('INFO', thread, ...msg)
    }

    /**
     * Log a warning.
     * @param msg The message.
     */
    public warn(...msg: string[]) {
        return this._log('WARN', 'MAIN', ...msg)
    }

    /**
     * Log an error.
     * @param msg The message.
     */
    public eror(...msg: string[]) {
        return this._log('EROR', 'MAIN', ...msg)
    }

    /**
     * Log a debugging message.
     * @param msg The message.
     */
    public dbug(...msg: string[]) {
        return this._log('DBUG', 'MAIN', ...msg)
    }
}

export const logger = new Logger()

export async function getUserFromUid(uid: number, oldUser?: User): Promise<User> {
    try {
        const data: { Variables: { space: { username: string, extcredits7: number } } } = JSON.parse(
            await rp(`https://www.mcbbs.net/api/mobile/index.php?module=profile&uid=${uid}`)
        )
        const { username, extcredits7: heartPresent } = data.Variables.space

        if (!oldUser) {
            oldUser = {
                banned: false,
                heartAbandoned: 0,
                heartInitial: heartPresent,
                heartAttained: NaN, // Won't be inherited.
                heartPresent: NaN, // Won't be inherited.
                lastChanged: new Date().getTime(),
                username: '' // Won't be inherited.
            }
        }

        const ans = {
            ...oldUser,
            heartPresent: heartPresent,
            heartAttained: heartPresent - oldUser.heartInitial - oldUser.heartAbandoned,
            username: username
        }

        if (
            oldUser.username !== ans.username ||
            oldUser.heartAttained !== ans.heartAttained ||
            oldUser.heartPresent !== ans.heartPresent
        ) {
            ans.lastChanged = new Date().getTime()
            const { diffBefore, diffAfter } = getDifference(oldUser, ans)
            logger.info('User', `- ${uid}: ${JSON.stringify(diffBefore)}.`)
            logger.info('User', `+ ${uid}: ${JSON.stringify(diffAfter)}.`)
        }

        return ans
    } catch {
        throw `Invalid user page for ${uid}.`
    }
}

/**
 * @deprecated Use `getUserFromUid` instead.
 */
export function getUserViaWebCode(webCode: string, uid: number, oldUser?: User): User {
    try {
        const username = getStringBetweenStrings(webCode, '<title>', '的个人资料 -  Minecraft(我的世界)中文论坛 - </title>')
        const heartPresent = parseInt(getStringBetweenStrings(webCode, '<li><em>爱心</em>', ' 心</li>'))

        if (!oldUser) {
            oldUser = {
                banned: false,
                heartAbandoned: 0,
                heartInitial: heartPresent,
                heartAttained: NaN, // Won't be inherited.
                heartPresent: NaN, // Won't be inherited.
                lastChanged: new Date().getTime(),
                username: '' // Won't be inherited.
            }
        }

        const ans = {
            ...oldUser,
            heartPresent: heartPresent,
            heartAttained: heartPresent - oldUser.heartInitial - oldUser.heartAbandoned,
            username: username
        }

        if (
            oldUser.username !== ans.username ||
            oldUser.heartAttained !== ans.heartAttained ||
            oldUser.heartPresent !== ans.heartPresent
        ) {
            ans.lastChanged = new Date().getTime()
            const { diffBefore, diffAfter } = getDifference(oldUser, ans)
            logger.info('User', `- ${uid}: ${JSON.stringify(diffBefore)}.`)
            logger.info('User', `+ ${uid}: ${JSON.stringify(diffAfter)}.`)
        }

        return ans
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

export function getDifference<T extends object, U extends T>(before: T, after: T): { diffBefore: U, diffAfter: U } {
    const ans = { diffBefore: {}, diffAfter: {} } as any
    for (const key in before) {
        if (before.hasOwnProperty(key)) {
            if (before[key] !== after[key]) {
                ans.diffBefore[key] = before[key]
                ans.diffAfter[key] = after[key]
            }
        }
    }
    return ans
}
