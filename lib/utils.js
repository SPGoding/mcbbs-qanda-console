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
export function writeConfig(fileName, content) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const filePath = path.join(__dirname, fileName);
        fs.writeJson(filePath, content);
    });
}
function getStringBetweenStrings(input, start, end) {
    return input.slice(input.indexOf(start) + start.length, input.indexOf(end));
}
export function getUserViaWebCode(webCode, oldUser) {
    const username = getStringBetweenStrings(webCode, '<title>', '的个人资料 -  Minecraft(我的世界)中文论坛 - </title>');
    const heartPresent = parseInt(getStringBetweenStrings(webCode, '<li><em>爱心</em>', ' 心</li>'));
    if (!oldUser) {
        oldUser = {
            banned: false,
            heartAbandoned: 0,
            heartAbandonedLinks: [],
            heartAttained: 0,
            heartInitial: heartPresent,
            heartPresent: NaN,
            username: ''
        };
    }
    let { banned, heartAbandoned, heartAbandonedLinks, heartAttained, heartInitial } = oldUser;
    return {
        username,
        heartInitial,
        heartAbandoned,
        heartAbandonedLinks,
        heartPresent,
        heartAttained: heartPresent - heartInitial - heartAbandoned,
        banned
    };
}
export function getBBCodeOfTable(table) {
    let ans = '[table]\n';
    for (const row of table) {
        ans += '[tr]';
        for (const element of row) {
            ans += `[td]${element}[/td]`;
        }
        ans += '[/tr]\n';
    }
    ans += '[/table]';
    return ans;
}
//# sourceMappingURL=utils.js.map