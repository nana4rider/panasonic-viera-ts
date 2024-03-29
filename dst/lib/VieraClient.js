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
exports.VieraClient = void 0;
const xmldom = require("@xmldom/xmldom");
const axios_1 = require("axios");
const crypto = require("crypto");
const xml = require("xml");
const xpath = require("xpath");
const VieraError_1 = require("./VieraError");
const VieraKey_1 = require("./VieraKey");
/** マクロ設定 */
const VieraKeyMacro = {};
VieraKeyMacro[VieraKey_1.VieraKey.tv] = [VieraKey_1.VieraKey.input_key, VieraKey_1.VieraKey.num_1];
VieraKeyMacro[VieraKey_1.VieraKey.hdmi1] = [VieraKey_1.VieraKey.input_key, VieraKey_1.VieraKey.num_2];
VieraKeyMacro[VieraKey_1.VieraKey.hdmi2] = [VieraKey_1.VieraKey.input_key, VieraKey_1.VieraKey.num_3];
VieraKeyMacro[VieraKey_1.VieraKey.hdmi3] = [VieraKey_1.VieraKey.input_key, VieraKey_1.VieraKey.num_4];
VieraKeyMacro[VieraKey_1.VieraKey.video] = [VieraKey_1.VieraKey.input_key, VieraKey_1.VieraKey.num_5];
class VieraClient {
    /**
     * コンストラクタ
     *
     * @param host VIERAのIPアドレス
     * @param auth 認証情報
     */
    constructor(host, auth) {
        this.host = host;
        this.auth = auth;
        this.session = {};
        this.client = axios_1.default.create({
            baseURL: `http://${this.host}:${VieraClient.PORT}`,
            headers: {
                'Accept': 'application/xml',
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/xml; charset="utf-8"',
                'Pragma': 'no-cache'
            }
        });
        this.client.interceptors.response.use(response => {
            return response;
        }, (error) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            if ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) {
                const returnXml = yield this.parseXml(error.response.data);
                this.checkError(returnXml, error.response);
            }
            throw error;
        }));
    }
    /**
     * VIERAに接続します。
     */
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.deriveSessionKeys();
            yield this.getEncryptSessionId();
        });
    }
    // remote
    /**
     * VIERAの画面にPINコードを表示します。
     *
     * @param name VIERAに表示する名前
     */
    displayPinCode(name = 'VieraClient') {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.postRemote('X_DisplayPinCode', {
                X_DeviceName: name
            }, false);
            const keyText = this.selectAsString(result, '//X_ChallengeKey');
            this.session.challenge = Buffer.from(keyText, 'base64');
        });
    }
    /**
     * VIERAの画面に表示されたPINコードを使い、認証を完了します。
     *
     * @param pincode PINコード
     */
    requestAuth(pincode) {
        return __awaiter(this, void 0, void 0, function* () {
            const [iv, key, hmacKey] = [this.session.challenge, Buffer.alloc(16), Buffer.alloc(32)];
            let [i, j, l, k] = [];
            for (i = k = 0; k < 16; i = k += 4) {
                key[i] = ~iv[i + 3] & 0xff;
                key[i + 1] = ~iv[i + 2] & 0xff;
                key[i + 2] = ~iv[i + 1] & 0xff;
                key[i + 3] = ~iv[i] & 0xff;
            }
            // Derive HMAC key from IV & HMAC key mask (taken from libtvconnect.so)
            const hmacKeyMaskVals = [
                0x15, 0xc9, 0x5a, 0xc2, 0xb0, 0x8a, 0xa7, 0xeb, 0x4e, 0x22, 0x8f, 0x81, 0x1e, 0x34, 0xd0,
                0x4f, 0xa5, 0x4b, 0xa7, 0xdc, 0xac, 0x98, 0x79, 0xfa, 0x8a, 0xcd, 0xa3, 0xfc, 0x24, 0x4f,
                0x38, 0x54
            ];
            for (j = l = 0; l < 32; j = l += 4) {
                hmacKey[j] = hmacKeyMaskVals[j] ^ iv[(j + 2) & 0xf];
                hmacKey[j + 1] = hmacKeyMaskVals[j + 1] ^ iv[(j + 3) & 0xf];
                hmacKey[j + 2] = hmacKeyMaskVals[j + 2] ^ iv[j & 0xf];
                hmacKey[j + 3] = hmacKeyMaskVals[j + 3] ^ iv[(j + 1) & 0xf];
            }
            const requestAuthResult = yield this.postRemote('X_RequestAuth', {
                X_AuthInfo: this.encryptPayload({ X_PinCode: pincode }, key, iv, hmacKey)
            }, false);
            const encryptAuthResult = this.selectAsString(requestAuthResult, '//X_AuthResult');
            const decryptAuthResult = this.decryptPayload(encryptAuthResult, key, iv);
            const documentAuthResult = this.parseXml(decryptAuthResult);
            const authAppId = this.selectAsString(documentAuthResult, '//X_ApplicationId');
            const authKey = this.selectAsString(documentAuthResult, '//X_Keyword');
            this.auth = { appId: authAppId, encKey: authKey };
            yield this.connect();
            return this.auth;
        });
    }
    getEncryptSessionId() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.auth)
                throw new Error('Not authenticated.');
            const result = yield this.postRemote('X_GetEncryptSessionId', [
                { X_ApplicationId: this.auth.appId },
                {
                    X_EncInfo: this.encryptPayload({
                        X_ApplicationId: this.auth.appId
                    })
                }
            ], false);
            this.session.id = this.selectAsString(result, '//X_SessionId');
            this.session.seqNum = 1;
            return this.session.id;
        });
    }
    /**
     * キー(ボタン入力)を送信します。
     *
     * @param key 送信するキー
     */
    sendKey(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const macro = VieraKeyMacro[key];
            if (!macro) {
                yield this.postRemote('X_SendKey', { X_KeyEvent: key });
                return;
            }
            for (const [index, macrokey] of macro.entries()) {
                if (index !== 0) {
                    yield new Promise(resolve => setTimeout(resolve, VieraClient.MACRO_INTERVAL));
                }
                yield this.postRemote('X_SendKey', { X_KeyEvent: macrokey });
            }
        });
    }
    /**
     * アプリを起動します。
     *
     * @param productId アプリID
     * @see {@link VieraClient.getApps} アプリIDを取得するメソッド
     */
    launchApp(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.postRemote('X_LaunchApp', [
                { X_AppType: 'vc_app' },
                { X_LaunchKeyword: `product_id=${productId}` }
            ]);
            return;
        });
    }
    /**
     * アプリのリストを取得します。
     *
     * @returns アプリのリスト
     */
    getApps() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.postRemote('X_GetAppList', undefined, true);
            const appList = this.selectAsString(result, '//X_AppList');
            if (!appList)
                return [];
            const vieraApps = [];
            for (const app of appList.split('>')) {
                const matcher = app.match(/'product_id=(.+?)'(.+?)'(.+?)'/);
                if (!matcher)
                    throw new Error(app);
                vieraApps.push({
                    productId: matcher[1],
                    name: matcher[2],
                    iconUrl: matcher[3],
                });
            }
            return vieraApps;
        });
    }
    /**
     * 電源がONか判定します。
     *
     * @returns 電源がONの場合true
     */
    isPowerOn() {
        return __awaiter(this, void 0, void 0, function* () {
            // HACK 他に良い方法があれば…
            return (yield this.getApps()).length !== 0;
        });
    }
    // rendering
    /**
     * 音量を取得します。
     *
     * @returns 音量
     */
    getVolume() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.postRendering('GetVolume', [
                { InstanceID: '0' },
                { Channel: 'Master' }
            ]);
            const volume = this.selectAsNumber(result, '//CurrentVolume');
            return volume;
        });
    }
    /**
     * 音量を設定します。
     *
     * @param volume 音量
     */
    setVolume(volume) {
        return __awaiter(this, void 0, void 0, function* () {
            if (isNaN(volume) || volume < 0 || volume > 100) {
                throw new Error('Volume must be in range from 0 to 100');
            }
            yield this.postRendering('SetVolume', [
                { InstanceID: '0' },
                { Channel: 'Master' },
                { DesiredVolume: volume }
            ]);
        });
    }
    /**
     * ミュートかどうかを取得します。
     *
     * @returns ミュートの場合、true
     */
    getMute() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.postRendering('GetMute', [
                { InstanceID: '0' },
                { Channel: 'Master' }
            ]);
            const mute = this.selectAsString(result, '//CurrentMute');
            return mute === '1';
        });
    }
    /**
     * ミュートを設定します。
     *
     * @param enable true:ミュート設定 false:ミュート解除
     */
    setMute(enable) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.postRendering('SetMute', [
                { InstanceID: '0' },
                { Channel: 'Master' },
                { DesiredMute: enable ? '1' : '0' }
            ]);
        });
    }
    // others
    /**
     * デバイス設定を取得します。
     *
     * @returns デバイス設定のドキュメント
     */
    getDeviceInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.client.get(VieraClient.PATH_DEVICE_INFO);
            return this.parseXml(response.data);
        });
    }
    /**
     * 機能リストを取得します。
     *
     * @returns 機能リストのドキュメント
     */
    getActionList() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.client.get(VieraClient.PATH_ACTION_LIST);
            return this.parseXml(response.data);
        });
    }
    // common
    postRemote(commandName, commandContent, encrypt) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = () => this.post(VieraClient.PATH_CONTROL_NRC, VieraClient.URN_REMOTE_CONTROL, commandName, commandContent, encrypt);
            try {
                return yield post();
            }
            catch (error) {
                if (error instanceof VieraError_1.VieraError && error.message === 'No such session') {
                    // When my daughter cuts off the power
                    yield this.connect();
                    return post();
                }
                throw error;
            }
        });
    }
    postRendering(commandName, commandContent) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.post(VieraClient.PATH_CONTROL_DMR, VieraClient.URN_RENDERING_CONTROL, commandName, commandContent, false);
        });
    }
    post(path, urn, commandName, commandContent = [], encrypt = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const commandAttr = { _attr: { ['xmlns:u']: `urn:${urn}` } };
            if (encrypt) {
                if (!this.auth)
                    throw new Error('Not authenticated.');
                const orgCommand = Array.isArray(commandContent) ? commandContent.slice() : [commandContent];
                orgCommand.push(commandAttr);
                const encInfo = [
                    { X_SessionId: this.session.id },
                    { X_SequenceNumber: String(this.session.seqNum + 1).padStart(8, '0') },
                    { X_OriginalCommand: [{ [`u:${commandName}`]: orgCommand }] }
                ];
                // console.log('[encInfoXml]\n' + xml(encInfo, {
                //   declaration: false,
                //   indent: '  '
                // }));
                commandName = 'X_EncryptedCommand';
                commandContent = [
                    { X_ApplicationId: this.auth.appId },
                    { X_EncInfo: this.encryptPayload(encInfo) }
                ];
            }
            const command = Array.isArray(commandContent) ? commandContent.slice() : [commandContent];
            command.push(commandAttr);
            const requestDoc = {
                's:Envelope': [{
                        _attr: {
                            'xmlns:s': 'http://schemas.xmlsoap.org/soap/envelope/',
                            's:encodingStyle': 'http://schemas.xmlsoap.org/soap/encoding/'
                        }
                    }, {
                        's:Body': [{
                                [`u:${commandName}`]: command
                            }]
                    }]
            };
            // console.log('[requestXml]\n' + xml(requestDoc, {
            //   declaration: true,
            //   indent: '  '
            // }));
            const response = yield this.client.post(path, xml(requestDoc, { declaration: true }), {
                headers: { SOAPAction: `"urn:${urn}#${commandName}"` }
            });
            this.session.seqNum++;
            const responseXml = response.data.replace(/(<X_EncResult>)(.*)(<\/X_EncResult>)/gm, (substring, start, content, end) => {
                return start + this.decryptPayload(content) + end;
            });
            // console.log('[responseXml]\n' + responseXml);
            const responseDoc = yield this.parseXml(responseXml);
            this.checkError(responseDoc, response);
            return responseDoc;
        });
    }
    checkError(returnXml, response) {
        if (xpath.select1('//*[local-name() = \'UPnPError\']', returnXml)) {
            throw new VieraError_1.VieraError(response, this.selectAsNumber(returnXml, '//*[local-name() = \'errorCode\']'), this.selectAsString(returnXml, '//*[local-name() = \'errorDescription\']'));
        }
    }
    selectAsString(document, path) {
        const value = xpath.select1(`string(${path})`, document);
        if (typeof value !== 'string')
            throw new Error(`${path}:${value} is not string.`);
        return value;
    }
    selectAsNumber(document, path) {
        const value = xpath.select1(`number(${path})`, document);
        if (typeof value !== 'number')
            throw new Error(`${path}:${value} is not number.`);
        return value;
    }
    deriveSessionKeys() {
        if (!this.auth)
            throw new Error('VieraAuth is null.');
        const iv = Buffer.from(this.auth.encKey, 'base64');
        this.session.iv = iv;
        // Derive key from IV
        this.session.key = Buffer.alloc(16);
        let i = 0;
        while (i < 16) {
            this.session.key[i] = iv[i + 2];
            this.session.key[i + 1] = iv[i + 3];
            this.session.key[i + 2] = iv[i];
            this.session.key[i + 3] = iv[i + 1];
            i += 4;
        }
        // HMAC key for comms is just the IV repeated twice
        this.session.hmacKey = Buffer.concat([iv, iv]);
    }
    encryptPayload(data, key = this.session.key, iv = this.session.iv, hmacKey = this.session.hmacKey) {
        const strdata = typeof data === 'string' ? data : xml(data);
        // Start with 12 random bytes
        let payload = Buffer.from(crypto.randomBytes(12));
        // Add 4 bytes (big endian) of the length of data
        const buf = Buffer.alloc(4);
        buf.writeUInt32BE(strdata.length, 0);
        payload = Buffer.concat([payload, buf, Buffer.from(strdata)]);
        // initialize AES-128-CBC with key and IV
        const aes = crypto.createCipheriv('aes-128-cbc', key, iv);
        // Encrypt the payload
        let ciphertext = aes.update(payload);
        ciphertext = Buffer.concat([ciphertext, aes.final()]);
        // compute HMAC-SHA-256
        const sig = crypto.createHmac('sha256', hmacKey).update(ciphertext).digest();
        // concat HMAC with AES encrypted payload
        const result = Buffer.concat([ciphertext, sig]);
        return result.toString('base64');
    }
    decryptPayload(data, key = this.session.key, iv = this.session.iv) {
        // Initialize AES-128-CBC with key and IV
        const aes = crypto.createDecipheriv('aes-128-cbc', key, iv);
        // Decrypt
        const decrypted = aes.update(Buffer.from(data, 'base64'));
        // Decrypted = Buffer.concat([decrypted, aes.final()]);
        // the valid decrypted data starts at byte offset 16
        const decryptedString = decrypted.toString('utf-8', 16, decrypted.indexOf('\u0000', 16));
        return decryptedString;
    }
    parseXml(string) {
        return new xmldom.DOMParser().parseFromString(string, 'application/xml');
    }
}
exports.VieraClient = VieraClient;
VieraClient.PATH_CONTROL_NRC = '/nrc/control_0';
VieraClient.PATH_CONTROL_DMR = '/dmr/control_0';
VieraClient.PATH_DEVICE_INFO = '/nrc/ddd.xml';
VieraClient.PATH_ACTION_LIST = '/nrc/sdd_0.xml';
VieraClient.URN_REMOTE_CONTROL = 'panasonic-com:service:p00NetworkControl:1';
VieraClient.URN_RENDERING_CONTROL = 'schemas-upnp-org:service:RenderingControl:1';
VieraClient.PORT = 55000;
VieraClient.MACRO_INTERVAL = 500;
//# sourceMappingURL=VieraClient.js.map