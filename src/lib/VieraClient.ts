import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import * as xml from 'xml';
import * as xmldom from 'xmldom';
import * as xpath from 'xpath';
import { VieraError } from './VieraError';
import { VieraKey } from './VieraKey';

type VieraSession = {
  key: Buffer;
  iv: Buffer;
  hmacKey: Buffer;
  challenge: Buffer;
  id: string;
  seqNum: number;
} | Record<string, never>;

type VieraApp = {
  productId: string;
  name: string;
  iconUrl: string;
} | Record<string, never>;

type VieraAuth = {
  appId: string;
  encKey: string;
};

/** マクロ設定 */
const VieraKeyMacro: { [key in VieraKey]?: VieraKey[] } = {};
VieraKeyMacro[VieraKey.tv] = [VieraKey.input_key, VieraKey.num_1];
VieraKeyMacro[VieraKey.hdmi1] = [VieraKey.input_key, VieraKey.num_2];
VieraKeyMacro[VieraKey.hdmi2] = [VieraKey.input_key, VieraKey.num_3];
VieraKeyMacro[VieraKey.hdmi3] = [VieraKey.input_key, VieraKey.num_4];
VieraKeyMacro[VieraKey.video] = [VieraKey.input_key, VieraKey.num_5];

class VieraClient {
  private static readonly PATH_CONTROL_NRC = '/nrc/control_0';
  private static readonly PATH_CONTROL_DMR = '/dmr/control_0';
  private static readonly PATH_DEVICE_INFO = '/nrc/ddd.xml';
  private static readonly PATH_ACTION_LIST = '/nrc/sdd_0.xml';

  private static readonly URN_REMOTE_CONTROL = 'panasonic-com:service:p00NetworkControl:1';
  private static readonly URN_RENDERING_CONTROL = 'schemas-upnp-org:service:RenderingControl:1';
  private static readonly PORT = 55000;
  private static readonly MACRO_INTERVAL = 200;

  private client: AxiosInstance;
  private session: VieraSession = {};

  constructor(private host: string, public auth?: VieraAuth) {
    this.client = axios.create({
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
    }, async error => {
      if (error.response && error.response.data) {
        const returnXml = await this.parseXml(error.response.data);
        this.checkError(returnXml, error.response);
      }
      throw error;
    });
  }

  async connect(): Promise<VieraSession> {
    this.deriveSessionKeys();
    await this.getEncryptSessionId();
    return this.session;
  }

  // remote

  async displayPinCode(name = 'VieraClient'): Promise<void> {
    const result = await this.postRemote('X_DisplayPinCode', {
      X_DeviceName: name
    }, false);

    const keyText = this.selectAsString(result, '//X_ChallengeKey');

    this.session.challenge = Buffer.from(keyText, 'base64');
  }

  async requestAuth(pincode: string): Promise<VieraAuth> {
    const [iv, key, hmacKey] = [this.session.challenge, Buffer.alloc(16), Buffer.alloc(32)];
    let [i, j, l, k]: number[] = [];
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

  async getEncryptSessionId(): Promise<string> {
    if (!this.auth) throw new Error('Not authenticated.');

    const result = await this.postRemote('X_GetEncryptSessionId', [
      { X_ApplicationId: this.auth.appId },
      {
        X_EncInfo: this.encryptPayload({
          X_ApplicationId: this.auth.appId
        })
      }], false);

    this.session.id = this.selectAsString(result, '//X_SessionId');
    this.session.seqNum = 1;

    return this.session.id;
  }

  async sendKey(key: VieraKey): Promise<void> {
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

  async launchApp(productId: string): Promise<void> {
    await this.postRemote('X_LaunchApp', [
      { X_AppType: 'vc_app' },
      { X_LaunchKeyword: `product_id=${productId}` }
    ]);
    return;
  }

  async getApps(): Promise<VieraApp[]> {
    const result = await this.postRemote('X_GetAppList', undefined, true);

    const appList = this.selectAsString(result, '//X_AppList');
    if (!appList) return [];

    const vieraApps: VieraApp[] = [];
    for (const app of appList.split('>')) {
      const matcher = app.match(/'product_id=(.+?)'(.+?)'(.+?)'/);
      if (!matcher) throw new Error(app);

      vieraApps.push({
        productId: matcher[1],
        name: matcher[2],
        iconUrl: matcher[3],
      });
    }

    return vieraApps;
  }

  // rendering

  async getVolume(): Promise<number> {
    const result = await this.postRendering('GetVolume', [
      { InstanceID: '0' },
      { Channel: 'Master' }
    ]);

    const volume = this.selectAsNumber(result, '//CurrentVolume');

    return volume;
  }

  async setVolume(volume: number): Promise<void> {
    if (isNaN(volume) || volume < 0 || volume > 100) {
      throw new Error('Volume must be in range from 0 to 100');
    }

    await this.postRendering('SetVolume', [
      { InstanceID: '0' },
      { Channel: 'Master' },
      { DesiredVolume: volume }
    ]);
  }

  async getMute(): Promise<boolean> {
    const result = await this.postRendering('GetMute', [
      { InstanceID: '0' },
      { Channel: 'Master' }
    ]);

    const mute = this.selectAsString(result, '//CurrentMute');

    return mute === '1';
  }

  async setMute(enable: boolean): Promise<void> {
    await this.postRendering('SetMute', [
      { InstanceID: '0' },
      { Channel: 'Master' },
      { DesiredMute: enable ? '1' : '0' }
    ]);
  }

  // others

  async getDeviceInfo(): Promise<Document> {
    const response = await this.client.get(VieraClient.PATH_DEVICE_INFO);
    return this.parseXml(response.data);
  }

  async getActionList(): Promise<Document> {
    const response = await this.client.get(VieraClient.PATH_ACTION_LIST);
    return this.parseXml(response.data);
  }

  // common

  async postRemote(commandName: string, commandContent?: xml.XmlObject | xml.XmlObject[],
    encrypt?: boolean): Promise<Document> {
    return this.post(VieraClient.PATH_CONTROL_NRC, VieraClient.URN_REMOTE_CONTROL,
      commandName, commandContent, encrypt);
  }

  async postRendering(commandName: string, commandContent?: xml.XmlObject | xml.XmlObject[]): Promise<Document> {
    return this.post(VieraClient.PATH_CONTROL_DMR, VieraClient.URN_RENDERING_CONTROL,
      commandName, commandContent, false);
  }

  private async post(path: string, urn: string, commandName: string,
    commandContent: xml.XmlObject | xml.XmlObject[] = [], encrypt = true): Promise<Document> {
    const commandAttr = { _attr: { ['xmlns:u']: `urn:${urn}` } };

    if (encrypt) {
      if (!this.auth) throw new Error('Not authenticated.');

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

    const response: AxiosResponse<string> = await this.client.post(path,
      xml(requestDoc, { declaration: true }), {
        headers: { SOAPAction: `"urn:${urn}#${commandName}"` }
      });

    this.session.seqNum++;

    const responseXml = response.data.replace(/(<X_EncResult>)(.*)(<\/X_EncResult>)/gm,
      (substring, start, content, end) => {
        return start + this.decryptPayload(content) + end;
      });

    // console.log('[responseXml]\n' + responseXml);

    const responseDoc = await this.parseXml(responseXml);
    this.checkError(responseDoc, response);

    return responseDoc;
  }

  private checkError(returnXml: Document, response: AxiosResponse<string>) {
    if (xpath.select1('//*[local-name() = \'UPnPError\']', returnXml)) {
      throw new VieraError(
        response,
        this.selectAsNumber(returnXml, '//*[local-name() = \'errorCode\']'),
        this.selectAsString(returnXml, '//*[local-name() = \'errorDescription\']'),
      );
    }
  }

  private selectAsString(document: Document, path: string): string {
    const value = xpath.select1(`string(${path})`, document);
    if (typeof value !== 'string') throw new Error(`${path}:${value} is not string.`);
    return value;
  }

  private selectAsNumber(document: Document, path: string): number {
    const value = xpath.select1(`number(${path})`, document);
    if (typeof value !== 'number') throw new Error(`${path}:${value} is not number.`);
    return value;
  }

  private deriveSessionKeys() {
    if (!this.auth) throw new Error('VieraAuth is null.');

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

  private encryptPayload(data: string | xml.XmlObject | xml.XmlObject[], key: Buffer = this.session.key,
    iv: Buffer = this.session.iv, hmacKey: Buffer = this.session.hmacKey): string {
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

  private decryptPayload(data: string, key: Buffer = this.session.key,
    iv: Buffer = this.session.iv): string {
    // Initialize AES-128-CBC with key and IV
    const aes = crypto.createDecipheriv('aes-128-cbc', key, iv);

    // Decrypt
    const decrypted = aes.update(Buffer.from(data, 'base64'));
    // Decrypted = Buffer.concat([decrypted, aes.final()]);

    // the valid decrypted data starts at byte offset 16
    const decryptedString = decrypted.toString('utf-8', 16, decrypted.indexOf('\u0000', 16));

    return decryptedString;
  }

  private parseXml(string: string): Document {
    return new xmldom.DOMParser().parseFromString(string, 'application/xml');
  }
}

export { VieraClient };
