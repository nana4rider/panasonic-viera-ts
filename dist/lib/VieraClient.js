"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VieraClient = void 0;
const axios_1 = require("axios");
const crypto = require("crypto");
const xml = require("xml");
const xmldom = require("xmldom");
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
        }, async (error) => {
            if (error.response?.data) {
                const returnXml = await this.parseXml(error.response.data);
                this.checkError(returnXml, error.response);
            }
            throw error;
        });
    }
    async connect() {
        this.deriveSessionKeys();
        await this.getEncryptSessionId();
        return this.session;
    }
    // remote
    async displayPinCode(name = 'VieraClient') {
        const result = await this.postRemote('X_DisplayPinCode', {
            X_DeviceName: name
        }, false);
        const keyText = this.selectAsString(result, '//X_ChallengeKey');
        this.session.challenge = Buffer.from(keyText, 'base64');
    }
    async requestAuth(pincode) {
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
        const requestAuthResult = await this.postRemote('X_RequestAuth', {
            X_AuthInfo: this.encryptPayload({ X_PinCode: pincode }, key, iv, hmacKey)
        }, false);
        const encryptAuthResult = this.selectAsString(requestAuthResult, '//X_AuthResult');
        const decryptAuthResult = this.decryptPayload(encryptAuthResult, key, iv);
        const documentAuthResult = this.parseXml(decryptAuthResult);
        const authAppId = this.selectAsString(documentAuthResult, '//X_ApplicationId');
        const authKey = this.selectAsString(documentAuthResult, '//X_Keyword');
        this.auth = { appId: authAppId, encKey: authKey };
        await this.connect();
        return this.auth;
    }
    async getEncryptSessionId() {
        if (!this.auth)
            throw new Error('Not authenticated.');
        const result = await this.postRemote('X_GetEncryptSessionId', [
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
    }
    async sendKey(key) {
        const macro = VieraKeyMacro[key];
        if (!macro) {
            await this.postRemote('X_SendKey', { X_KeyEvent: key });
            return;
        }
        for (const [index, macrokey] of macro.entries()) {
            if (index !== 0) {
                await new Promise(resolve => setTimeout(resolve, VieraClient.MACRO_INTERVAL));
            }
            await this.postRemote('X_SendKey', { X_KeyEvent: macrokey });
        }
    }
    async launchApp(productId) {
        await this.postRemote('X_LaunchApp', [
            { X_AppType: 'vc_app' },
            { X_LaunchKeyword: `product_id=${productId}` }
        ]);
        return;
    }
    async getApps() {
        const result = await this.postRemote('X_GetAppList', undefined, true);
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
    }
    // rendering
    async getVolume() {
        const result = await this.postRendering('GetVolume', [
            { InstanceID: '0' },
            { Channel: 'Master' }
        ]);
        const volume = this.selectAsNumber(result, '//CurrentVolume');
        return volume;
    }
    async setVolume(volume) {
        if (isNaN(volume) || volume < 0 || volume > 100) {
            throw new Error('Volume must be in range from 0 to 100');
        }
        await this.postRendering('SetVolume', [
            { InstanceID: '0' },
            { Channel: 'Master' },
            { DesiredVolume: volume }
        ]);
    }
    async getMute() {
        const result = await this.postRendering('GetMute', [
            { InstanceID: '0' },
            { Channel: 'Master' }
        ]);
        const mute = this.selectAsString(result, '//CurrentMute');
        return mute === '1';
    }
    async setMute(enable) {
        await this.postRendering('SetMute', [
            { InstanceID: '0' },
            { Channel: 'Master' },
            { DesiredMute: enable ? '1' : '0' }
        ]);
    }
    // others
    async getDeviceInfo() {
        const response = await this.client.get(VieraClient.PATH_DEVICE_INFO);
        return this.parseXml(response.data);
    }
    async getActionList() {
        const response = await this.client.get(VieraClient.PATH_ACTION_LIST);
        return this.parseXml(response.data);
    }
    // common
    async postRemote(commandName, commandContent, encrypt) {
        return this.post(VieraClient.PATH_CONTROL_NRC, VieraClient.URN_REMOTE_CONTROL, commandName, commandContent, encrypt);
    }
    async postRendering(commandName, commandContent) {
        return this.post(VieraClient.PATH_CONTROL_DMR, VieraClient.URN_RENDERING_CONTROL, commandName, commandContent, false);
    }
    async post(path, urn, commandName, commandContent = [], encrypt = true) {
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
        const response = await this.client.post(path, xml(requestDoc, { declaration: true }), {
            headers: { SOAPAction: `"urn:${urn}#${commandName}"` }
        });
        this.session.seqNum++;
        const responseXml = response.data.replace(/(<X_EncResult>)(.*)(<\/X_EncResult>)/gm, (substring, start, content, end) => {
            return start + this.decryptPayload(content) + end;
        });
        // console.log('[responseXml]\n' + responseXml);
        const responseDoc = await this.parseXml(responseXml);
        this.checkError(responseDoc, response);
        return responseDoc;
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
VieraClient.MACRO_INTERVAL = 200;
//# sourceMappingURL=VieraClient.js.map