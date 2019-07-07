import * as fs from 'fs-extra'
import * as path from 'path'
import { join } from 'path'

/**
 * A logger.
 */
export default class Logger {
    private _indent = 0

    private _log(type: 'INFO' | 'WARN' | 'EROR' | 'DBUG', ...msg: string[]) {
        const date = new Date()
        const fixTwoDigits = (number: number) => number < 10 ? `0${number}` : number.toString()
        const fixThreeDigits = (number: number) => number < 10 ? `00${number}` : number < 100 ? `0${number}` : number.toString()
        const time = `${fixTwoDigits(date.getHours())}:${fixTwoDigits(date.getMinutes())}:${
            fixTwoDigits(date.getSeconds())}:${fixThreeDigits(date.getMilliseconds())}`
        const day = `${date.getFullYear()}-${fixTwoDigits(date.getMonth() + 1)}-${fixTwoDigits(date.getDate())}`
        msg.forEach(v => {
            const m = `[${time}] [MAIN] [${type}] ${'  '.repeat(this._indent)}${v}`
            const logPath = join(__dirname, `logs/${day}.log`)
            if (!fs.pathExistsSync(path.dirname(logPath))) {
                fs.mkdirSync(path.dirname(logPath))
            }
            console.log(m)
            fs.appendFileSync(logPath, m, { encoding: 'utf8' })
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
    public info(...msg: string[]) {
        return this._log('INFO', ...msg)
    }

    /**
     * Log a warning.
     * @param msg The message.
     */
    public warn(...msg: string[]) {
        return this._log('WARN', ...msg)
    }

    /**
     * Log an error.
     * @param msg The message.
     */
    public error(...msg: string[]) {
        return this._log('EROR', ...msg)
    }

    /**
     * Log a debugging message.
     * @param msg The message.
     */
    public dbug(...msg: string[]) {
        return this._log('DBUG', ...msg)
    }

    /**
     * Get all logs.
     */
    public toString() {
        return this._logs.join('\n')
    }
}
