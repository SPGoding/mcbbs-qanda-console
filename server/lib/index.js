"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const rp = require("request-promise-native");
const http = require("http");
const path = require("path");
const canvas_1 = require("canvas");
const utils_1 = require("./utils");
let config = { password: '', interal: NaN, port: NaN };
let users = {};
let rank;
let rankImage;
let rankTime = '';
let registrationBBCode = '';
let abandonedHeartBBCode = '';
function startup() {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        config = yield utils_1.loadConfig('config.json', { password: '', interal: 600000, port: 80 });
        users = yield utils_1.loadConfig('users.json', {});
        yield updateInfo();
        setInterval(updateInfo, config.interal);
        http
            .createServer((req, res) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (req.method === 'GET') {
                if (req.url === '/rank') {
                    res.writeHead(200, { 'Content-Type': 'image/png' });
                    res.end(rankImage);
                }
                else if (req.url === '/registration-bbcode') {
                    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end(registrationBBCode);
                }
                else if (req.url === '/abandoned-heart-bbcode') {
                    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end(abandonedHeartBBCode);
                }
                else {
                    res.writeHead(404, 'Resource Not Found', { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end('<!doctype html><html><head><title>404</title></head><body>404: Resource Not Found</body></html>');
                }
            }
            else if (req.method === 'POST') {
                if (req.url === '/add-user') {
                    res.setHeader('Content-Type', "text/html");
                }
                else if (req.url === '/del-user') {
                    res.setHeader('Content-Type', "text/html");
                }
                else if (req.url === '/edit-user') {
                    res.setHeader('Content-Type', "text/html");
                }
                else {
                    res.writeHead(404, 'Resource Not Found', { 'Content-Type': 'text/html' });
                    res.end('<!doctype html><html><head><title>404</title></head><body>404: Resource Not Found</body></html>');
                }
            }
        }))
            .listen(config.port)
            .on('error', e => {
            console.error(e.message);
        });
        console.log(`Server is running at localhost:${config.port}.`);
    });
}
setImmediate(startup);
function updateInfo() {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        yield updateUserInfo();
        updateRankInfo();
        rankImage = yield drawRankTable();
        registrationBBCode = getRegistrationBBCode();
        abandonedHeartBBCode = getAbandonedHeartBBCode();
    });
}
function updateUserInfo() {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        for (const uid in users) {
            try {
                const user = users[uid];
                if (!user.banned) {
                    const url = `http://www.mcbbs.net/?${uid}`;
                    const webCode = yield rp(url);
                    const userUpdated = utils_1.getUserViaWebCode(webCode, user);
                    users[uid] = userUpdated;
                }
            }
            catch (e) {
                console.error(`Updating info error: '${e}'.`);
            }
        }
        utils_1.writeConfig('users.json', users);
    });
}
function updateRankInfo() {
    rank = [];
    for (const uid in users) {
        const user = users[uid];
        rank.push({ uid: parseInt(uid), heart: user.heartAttained });
    }
    rank.sort((a, b) => b.heart - a.heart);
    rankTime = new Date().toLocaleString();
}
function drawRankTable() {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const table = [];
        for (const ele of rank.slice(0, 10)) {
            const row = [rank.indexOf(ele) + 1, users[ele.uid].username, ele.heart];
            table.push(row);
        }
        const canvas = new canvas_1.Canvas(554, 260);
        const ctx = canvas.getContext('2d');
        const img = yield canvas_1.loadImage(path.join(__dirname, '../img/table.png'));
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const fontHeight = 20;
        const rowHeight = 21;
        const columnWidthes = [0, 94, 94 + 312];
        const padding = 4;
        ctx.font = `${fontHeight}px Microsoft Yahei`;
        let rowNumber = 1;
        for (const row of table) {
            let columnNumber = 0;
            for (const cell of row) {
                ctx.fillText(cell.toString(), padding + columnWidthes[columnNumber], rowNumber * rowHeight + fontHeight);
                columnNumber++;
            }
            rowNumber++;
        }
        ctx.fillText(rankTime, canvas.width / 2 - ctx.measureText(rankTime).width / 2, canvas.height - padding);
        return canvas.toBuffer('image/png');
    });
}
function getRegistrationBBCode() {
    const table = [];
    let row = [
        '[b]用户名[/b]', '[b]UID[/b]', '[color=Purple][b]爱心数量[/b][/color]',
        '[b]用户名[/b]', '[b]UID[/b]', '[color=Purple][b]爱心数量[/b][/color]'
    ];
    for (const uid in users) {
        const user = users[uid];
        if (row.length >= 6) {
            table.push(row);
            row = [];
        }
        row = [...row, user.username, uid, user.heartInitial];
    }
    table.push(row);
    return utils_1.getBBCodeOfTable(table);
}
function getAbandonedHeartBBCode() {
    const table = [
        ['[b]用户名[/b]', '[b]UID[/b]', '[color=Red][b]放弃数量[/b][/color]', '[b]相关链接[/b]']
    ];
    let row = [];
    for (const uid in users) {
        const user = users[uid];
        if (user.heartAbandoned) {
            row = [
                user.username, uid, user.heartAbandoned,
                user.heartAbandonedLinks.map(v => `[url=${v}]最佳申请帖[/url]`).join('\n')
            ];
            table.push(row);
        }
    }
    return utils_1.getBBCodeOfTable(table);
}
function addUser(uid, heartInitial) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const url = `http://www.mcbbs.net/?${uid}`;
        const webCode = yield rp(url);
        const user = utils_1.getUserViaWebCode(webCode);
        if (heartInitial !== undefined) {
            user.heartInitial = heartInitial;
            user.heartAttained = user.heartPresent - user.heartInitial - user.heartAbandoned;
        }
        users[uid] = user;
    });
}
function delUser(uid) {
    delete users[uid];
}
function editUser(uid, heartInitial, heartAbandoned, heartAbandonedLinks, banned) {
    const user = users[uid];
    user.heartInitial = heartInitial;
    user.heartAbandoned = heartAbandoned;
    user.heartAbandonedLinks = heartAbandonedLinks;
    user.banned = banned;
}
//# sourceMappingURL=index.js.map