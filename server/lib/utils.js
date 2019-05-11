"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs = require("fs-extra");
const path = require("path");
function loadConfig(fileName, def) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const filePath = path.join(__dirname, fileName);
        if (!(yield fs.pathExists(filePath))) {
            fs.writeJson(filePath, def);
        }
        const config = fs.readJson(filePath, { encoding: 'utf8' });
        return config;
    });
}
exports.loadConfig = loadConfig;
function writeConfig(fileName, content) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const filePath = path.join(__dirname, fileName);
        fs.writeJson(filePath, content);
    });
}
exports.writeConfig = writeConfig;
function getStringBetweenStrings(input, start, end) {
    return input.slice(input.indexOf(start) + start.length, input.indexOf(end));
}
function getUserViaWebCode(webCode, oldUser) {
    const username = getStringBetweenStrings(webCode, '<title>', '的个人资料 -  Minecraft(我的世界)中文论坛 - </title>');
    const heartPresent = parseInt(getStringBetweenStrings(webCode, '<li><em>爱心</em>', ' 心</li>'));
    if (!oldUser) {
        oldUser = {
            banned: false,
            heartAbandoned: 0,
            heartAbandonedLinks: [],
            heartInitial: heartPresent,
            heartAttained: NaN,
            heartPresent: NaN,
            username: '' // Won't be inherited.
        };
    }
    let { banned, heartAbandoned, heartAbandonedLinks, heartInitial } = oldUser;
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
exports.getUserViaWebCode = getUserViaWebCode;
function getBBCodeOfTable(table) {
    const tablePrefix = '[align=center][table=540,white]';
    const tableSuffix = '[/table][/align]';
    const rowPrefix = '[tr]';
    const rowSuffix = '[/tr]';
    const dataPrefix = '[td] ';
    const dataSuffix = '[/td]';
    let ans = `${tablePrefix}\n`;
    for (const row of table) {
        ans += rowPrefix;
        for (const element of row) {
            ans += `${dataPrefix}${element}${dataSuffix}`;
        }
        ans += `${rowSuffix}\n`;
    }
    ans += tableSuffix;
    return ans;
}
exports.getBBCodeOfTable = getBBCodeOfTable;
//# sourceMappingURL=utils.js.map