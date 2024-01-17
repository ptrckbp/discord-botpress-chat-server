"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startHealthCheckBeacon = void 0;
const express_1 = __importDefault(require("express"));
const startHealthCheckBeacon = () => {
    const app = (0, express_1.default)();
    app.get('/', function (req, res) {
        res.send('Server is up!');
        console.log('Health check beacon pinged!');
    });
    app.listen(process.env.PORT || 3000);
    console.log('[CHAT-SERVER]: Server is listening ✨');
};
exports.startHealthCheckBeacon = startHealthCheckBeacon;
