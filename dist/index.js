"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const discord_js_1 = require("discord.js");
const healthcheck_1 = require("./healthcheck");
const discord_1 = require("./services/discord");
(0, dotenv_1.config)();
function initializeListeners() {
    // checks if botpress is up and running
    discord_1.discordClient.once(discord_js_1.Events.ClientReady, healthcheck_1.startHealthCheckBeacon);
    // listen to new messages from discord
    discord_1.discordClient.on(discord_js_1.Events.MessageCreate, (interaction) => __awaiter(this, void 0, void 0, function* () {
        console.log(`[CHAT-SERVER]: There's a new user message! 🆕 : "${interaction.cleanContent}"`);
        (0, discord_1.handleMessageCreated)(interaction);
    }));
    // send payload to botpress to ignore conversation when message is edited
    discord_1.discordClient.on(discord_js_1.Events.MessageUpdate, (oldMessage, newMessage) => __awaiter(this, void 0, void 0, function* () {
        console.log(`[CHAT-SERVER]: A message was updated! 📝 : "${oldMessage.cleanContent}" => "${newMessage.cleanContent}"`);
        (0, discord_1.handleMessageUpdated)(oldMessage, newMessage);
    }));
}
initializeListeners();
