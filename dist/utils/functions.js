"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkMessageRestrictions = void 0;
function checkMessageRestrictions(message) {
    var _a, _b;
    if (message.guildId != process.env.DISCORD_SERVER_ID) {
        console.log('[CHAT-SERVER]: Ignoring message from other server ⛔');
        return false;
    }
    if (message.system) {
        console.log('[CHAT-SERVER]: Ignoring system message ⛔');
        return false;
    }
    if ((_a = message.author) === null || _a === void 0 ? void 0 : _a.bot) {
        console.log('[CHAT-SERVER]: Ignoring message from bot ⛔');
        return false;
    }
    if (((_b = message.channel) === null || _b === void 0 ? void 0 : _b.type) !== 11) {
        console.log('[CHAT-SERVER]: Ignoring message from non-thread channel ⛔');
        return false;
    }
    return true;
}
exports.checkMessageRestrictions = checkMessageRestrictions;
