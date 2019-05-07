import * as tslib_1 from "tslib";
import * as rp from 'request-promise-native';
import { loadConfig } from './utils';
let config;
let users;
(function startup() {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        config = yield loadConfig('config.json', { password: '', interal: 600000 });
        users = yield loadConfig('users.json', []);
        setInterval(updateInfo, config.interal);
    });
})();
function updateInfo() {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        for (const user of users) {
            try {
                if (!user.banned) {
                    const url = `http://www.mcbbs.net/?${user.uid}`;
                    const webCode = rp(url);
                }
            }
            catch (e) {
                console.error(`Updating info error: '${e}'.`);
            }
        }
    });
}
//# sourceMappingURL=index.js.map