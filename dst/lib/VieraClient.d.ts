import * as xml from 'xml';
import { VieraKey } from './VieraKey';
declare type VieraApp = {
    productId: string;
    name: string;
    iconUrl: string;
};
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
    /**
     * コンストラクタ
     *
     * @param host VIERAのIPアドレス
     * @param auth 認証情報
     */
    constructor(host: string, auth?: VieraAuth | undefined);
    /**
     * VIERAに接続します。
     */
    connect(): Promise<void>;
    /**
     * VIERAの画面にPINコードを表示します。
     *
     * @param name VIERAに表示する名前
     */
    displayPinCode(name?: string): Promise<void>;
    /**
     * VIERAの画面に表示されたPINコードを使い、認証を完了します。
     *
     * @param pincode PINコード
     */
    requestAuth(pincode: string): Promise<VieraAuth>;
    private getEncryptSessionId;
    /**
     * キー(ボタン入力)を送信します。
     *
     * @param key 送信するキー
     */
    sendKey(key: VieraKey): Promise<void>;
    /**
     * アプリを起動します。
     *
     * @param productId アプリID
     * @see {@link VieraClient.getApps} アプリIDを取得するメソッド
     */
    launchApp(productId: string): Promise<void>;
    /**
     * アプリのリストを取得します。
     *
     * @returns アプリのリスト
     */
    getApps(): Promise<VieraApp[]>;
    /**
     * 電源がONか判定します。
     *
     * @returns 電源がONの場合true
     */
    isPowerOn(): Promise<boolean>;
    /**
     * 音量を取得します。
     *
     * @returns 音量
     */
    getVolume(): Promise<number>;
    /**
     * 音量を設定します。
     *
     * @param volume 音量
     */
    setVolume(volume: number): Promise<void>;
    /**
     * ミュートかどうかを取得します。
     *
     * @returns ミュートの場合、true
     */
    getMute(): Promise<boolean>;
    /**
     * ミュートを設定します。
     *
     * @param enable true:ミュート設定 false:ミュート解除
     */
    setMute(enable: boolean): Promise<void>;
    /**
     * デバイス設定を取得します。
     *
     * @returns デバイス設定のドキュメント
     */
    getDeviceInfo(): Promise<Document>;
    /**
     * 機能リストを取得します。
     *
     * @returns 機能リストのドキュメント
     */
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
//# sourceMappingURL=VieraClient.d.ts.map