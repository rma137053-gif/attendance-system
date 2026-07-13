"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureUploadDir = ensureUploadDir;
exports.savePhoto = savePhoto;
exports.getPhoto = getPhoto;
exports.deletePhoto = deletePhoto;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const config_1 = require("../config");
function ensureUploadDir() {
    if (config_1.config.storageType === 'local') {
        fs_1.default.mkdirSync(config_1.config.uploadDir, { recursive: true });
    }
}
/** Save a file buffer to local storage. Returns the storage key. */
async function savePhoto(buffer, originalName) {
    if (config_1.config.storageType === 'local') {
        const ext = path_1.default.extname(originalName) || '.jpg';
        const key = `${(0, uuid_1.v4)()}${ext}`;
        const filePath = path_1.default.join(config_1.config.uploadDir, key);
        await fs_1.default.promises.writeFile(filePath, buffer);
        return key;
    }
    // S3 implementation would go here
    throw new Error('S3 storage not yet implemented');
}
/** Get a file buffer from local storage by key */
async function getPhoto(key) {
    if (config_1.config.storageType === 'local') {
        const filePath = path_1.default.join(config_1.config.uploadDir, key);
        return fs_1.default.promises.readFile(filePath);
    }
    throw new Error('S3 storage not yet implemented');
}
/** Delete a photo from local storage */
async function deletePhoto(key) {
    if (config_1.config.storageType === 'local') {
        const filePath = path_1.default.join(config_1.config.uploadDir, key);
        await fs_1.default.promises.unlink(filePath).catch(() => { });
    }
}
