import * as fs from 'fs-extra'
import * as path from 'path'

export async function loadConfig<T>(fileName: string, def?: T): Promise<T> {
    const filePath = path.join(__dirname, fileName)

    if (!await fs.pathExists(filePath)) {
        fs.writeJson(filePath, def)
    }

    const config = fs.readJson(filePath, { encoding: 'utf8' })

    return config
}
