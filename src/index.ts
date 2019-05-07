import * as rp from 'request-promise-native'
import { loadConfig } from './utils'
import { fileURLToPath } from 'url';

interface Config {
    password: string,
    interal: number
}

interface User {
    uid: number,
    username: string,
    heartInitial: number,
    heartAbandoned: number,
    heartAbandonedLinks: string[],
    heartPresent: number,
    heartAttained: number,
    banned: boolean
}

let config: Config
let users: User[]

    ; (async function startup() {
        config = await loadConfig<Config>('config.json', { password: '', interal: 600000 })
        users = await loadConfig<User[]>('users.json', [])

        setInterval(updateInfo, config.interal)
    })()

async function updateInfo() {
    for (const user of users) {
        try {
            if (!user.banned) {
                const url = `http://www.mcbbs.net/?${user.uid}`
                const webCode = rp(url)
                
            }
        }
        catch (e) {
            console.error(`Updating info error: '${e}'.`)
        }
    }
}
