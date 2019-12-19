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
    emeraldAmount: number,
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

export function getUserViaWebCode(webCode: string, oldUser?: User): User {
    try {
        const username = getStringBetweenStrings(webCode, '<title>', '的个人资料 -  Minecraft(我的世界)中文论坛 - </title>')
        const heartPresent = parseInt(getStringBetweenStrings(webCode, '<li><em>爱心</em>', ' 心</li>'))

        if (oldUser) {
            const { username: oldUsername } = oldUser
            if (oldUsername !== username) {
                logger.info('User', `'${oldUsername}' changed zis name to '${username}'.`)
            }
        }

        if (!oldUser) {
            oldUser = {
                banned: false,
                heartAbandoned: 0,
                heartInitial: heartPresent,
                heartAttained: NaN, // Won't be inherited.
                heartPresent: NaN, // Won't be inherited.
                username: '' // Won't be inherited.
            }
        }

        const { banned: banned, heartAbandoned: heartAbandoned, heartInitial: heartInitial } = oldUser

        return {
            username: username,
            heartInitial: heartInitial,
            heartAbandoned: heartAbandoned,
            heartPresent: heartPresent,
            heartAttained: heartPresent - heartInitial - heartAbandoned,
            banned: banned
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
