import * as tslib_1 from "tslib";
import * as fs from 'fs-extra';
import * as path from 'path';
export function loadConfig(fileName, def) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const filePath = path.join(__dirname, fileName);
        if (!(yield fs.pathExists(filePath))) {
            fs.writeJson(filePath, def);
        }
        const config = fs.readJson(filePath, { encoding: 'utf8' });
        return config;
    });
}
//# sourceMappingURL=utils.js.map