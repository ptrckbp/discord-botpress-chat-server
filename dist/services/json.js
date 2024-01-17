"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.removeConversationFromListeningList = exports.getConversationData = exports.updateConversationData = exports.isConversationBeingListened = exports.addConversationToActiveList = exports.getActiveConversations = exports.isKeyInJsonObject = exports.addKeyValueToJsonObject = exports.getKeyValueFromJsonObject = exports.getJsonContent = exports.writeJsonContent = void 0;
const fs = __importStar(require("fs"));
function writeJsonContent(path, content) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            fs.writeFile(path, JSON.stringify(content), (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    });
}
exports.writeJsonContent = writeJsonContent;
function getJsonContent(path) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            fs.readFile(path, 'utf8', (error, data) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(JSON.parse(data));
            });
        });
    });
}
exports.getJsonContent = getJsonContent;
function getKeyValueFromJsonObject(path, key) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            fs.readFile(path, 'utf8', (error, data) => {
                if (error) {
                    reject(error);
                    return;
                }
                const json = JSON.parse(data);
                const value = json[key];
                resolve(value);
            });
        });
    });
}
exports.getKeyValueFromJsonObject = getKeyValueFromJsonObject;
function addKeyValueToJsonObject(path, key, value) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            fs.readFile(path, 'utf8', (error, data) => {
                if (error) {
                    reject(error);
                    return;
                }
                const json = JSON.parse(data);
                json[key] = value;
                writeJsonContent(path, json)
                    .then(() => {
                    resolve();
                })
                    .catch((error) => {
                    reject(error);
                });
            });
        });
    });
}
exports.addKeyValueToJsonObject = addKeyValueToJsonObject;
function isKeyInJsonObject(path, key) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, 'utf8', (error, data) => {
            if (error) {
                reject(error);
                return;
            }
            const json = JSON.parse(data);
            const isKeyInJsonObject = key in json;
            resolve(isKeyInJsonObject);
        });
    });
}
exports.isKeyInJsonObject = isKeyInJsonObject;
// ------------------------------------------------------
// ------------------------------------------------------
// ------------------------------------------------------
// ------------------------------------------------------
function getActiveConversations() {
    return __awaiter(this, void 0, void 0, function* () {
        return yield getJsonContent('./src/data/activeConversations.json');
    });
}
exports.getActiveConversations = getActiveConversations;
function addConversationToActiveList(conversationId, conversationData) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield addKeyValueToJsonObject('./src/data/activeConversations.json', conversationId, conversationData);
    });
}
exports.addConversationToActiveList = addConversationToActiveList;
function isConversationBeingListened(conversationId) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield isKeyInJsonObject('./src/data/activeConversations.json', conversationId);
    });
}
exports.isConversationBeingListened = isConversationBeingListened;
function updateConversationData(conversationId, conversationData) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield addKeyValueToJsonObject('./src/data/activeConversations.json', conversationId, conversationData);
    });
}
exports.updateConversationData = updateConversationData;
function getConversationData(conversationId) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield getKeyValueFromJsonObject('./src/data/activeConversations.json', conversationId);
    });
}
exports.getConversationData = getConversationData;
function removeConversationFromListeningList(conversationId) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            fs.readFile('./src/data/activeConversations.json', 'utf8', (error, data) => {
                if (error) {
                    reject(error);
                    return;
                }
                const json = JSON.parse(data);
                const isKeyInJsonObject = conversationId in json;
                if (!isKeyInJsonObject) {
                    resolve(false);
                    return;
                }
                delete json[conversationId];
                writeJsonContent('./src/data/activeConversations.json', json)
                    .then(() => {
                    resolve(true);
                })
                    .catch((error) => {
                    reject(error);
                });
            });
        });
    });
}
exports.removeConversationFromListeningList = removeConversationFromListeningList;
