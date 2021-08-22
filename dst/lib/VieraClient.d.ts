/// <reference types="node" />
import * as xml from 'xml';
import { VieraKey } from './VieraKey';
declare type VieraSession = {
    key: Buffer;
    iv: Buffer;
    hmacKey: Buffer;
    challenge: Buffer;
    id: string;
    seqNum: number;
} | Record<string, never>;
declare type VieraApp = {
    productId: string;
    name: string;
    iconUrl: string;
} | Record<string, never>;
declare type VieraAuth = {
    appId: string;
    encKey: string;
};
declare class VieraClient {
    private host;
    auth?: VieraAuth | undefined;
    private static readonly PATH_CONTROL_NRC;
    private static readonly PATH_CONTROL_DMR;
    private static readonly PATH_DEVICE_INFO;
    private static readonly PATH_ACTION_LIST;
    private static readonly URN_REMOTE_CONTROL;
    private static readonly URN_RENDERING_CONTROL;
    private static readonly PORT;
    private static readonly MACRO_INTERVAL;
    private client;
    private session;
    constructor(host: string, auth?: VieraAuth | undefined);
    connect(): Promise<VieraSession>;
    displayPinCode(name?: string): Promise<void>;
    requestAuth(pincode: string): Promise<VieraAuth>;
    getEncryptSessionId(): Promise<string>;
    sendKey(key: VieraKey): Promise<void>;
    launchApp(productId: string): Promise<void>;
    getApps(): Promise<VieraApp[]>;
    getVolume(): Promise<number>;
    setVolume(volume: number): Promise<void>;
    getMute(): Promise<boolean>;
    setMute(enable: boolean): Promise<void>;
    getDeviceInfo(): Promise<Document>;
    getActionList(): Promise<Document>;
    postRemote(commandName: string, commandContent?: xml.XmlObject | xml.XmlObject[], encrypt?: boolean): Promise<Document>;
    postRendering(commandName: string, commandContent?: xml.XmlObject | xml.XmlObject[]): Promise<Document>;
    private post;
    private checkError;
    private selectAsString;
    private selectAsNumber;
    private deriveSessionKeys;
    private encryptPayload;
    private decryptPayload;
    private parseXml;
}
export { VieraClient };
