declare const VieraKey: {
    /** 電源 */
    readonly power: "NRC_POWER-ONOFF";
    /** 録画一覧 */
    readonly reclist: "NRC_RECLIST-ONOFF";
    /** 画面表示 */
    readonly display: "NRC_DISP_MODE-ONOFF";
    /** 入力切替 */
    readonly input_key: "NRC_CHG_INPUT-ONOFF";
    /** データ */
    readonly data: "NRC_DATA-ONOFF";
    /** アレコレ */
    /** アプリ */
    readonly apps: "NRC_APPS-ONOFF";
    /** マイアプリ */
    /** メニュー */
    readonly menu: "NRC_MENU-ONOFF";
    /** 青 */
    readonly blue: "NRC_BLUE-ONOFF";
    /** 赤 */
    readonly red: "NRC_RED-ONOFF";
    /** 緑 */
    readonly green: "NRC_GREEN-ONOFF";
    /** 黄 */
    readonly yellow: "NRC_YELLOW-ONOFF";
    /** サブメニュー */
    readonly option: "NRC_SUBMENU-ONOFF";
    /** ホーム */
    readonly home: "NRC_HOME-ONOFF";
    /** 番組表 */
    readonly epg: "NRC_EPG-ONOFF";
    /** 戻る */
    readonly back: "NRC_RETURN-ONOFF";
    /** ↑ */
    readonly up: "NRC_UP-ONOFF";
    /** ↓ */
    readonly down: "NRC_DOWN-ONOFF";
    /** ← */
    readonly left: "NRC_LEFT-ONOFF";
    /** → */
    readonly right: "NRC_RIGHT-ONOFF";
    /** 決定 */
    readonly enter: "NRC_ENTER-ONOFF";
    /** 地上 */
    readonly net_td: "NRC_NET_TD-ONOFF";
    /** BS */
    readonly net_bs: "NRC_NET_BS-ONOFF";
    /** CS */
    readonly net_cs: "NRC_NET_CS-ONOFF";
    /** 4K */
    /** 1チャンネル */
    readonly num_1: "NRC_D1-ONOFF";
    /** 2チャンネル */
    readonly num_2: "NRC_D2-ONOFF";
    /** 3チャンネル */
    readonly num_3: "NRC_D3-ONOFF";
    /** 4チャンネル */
    readonly num_4: "NRC_D4-ONOFF";
    /** 5チャンネル */
    readonly num_5: "NRC_D5-ONOFF";
    /** 6チャンネル */
    readonly num_6: "NRC_D6-ONOFF";
    /** 7チャンネル */
    readonly num_7: "NRC_D7-ONOFF";
    /** 8チャンネル */
    readonly num_8: "NRC_D8-ONOFF";
    /** 9チャンネル */
    readonly num_9: "NRC_D9-ONOFF";
    /** 10チャンネル */
    readonly num_0: "NRC_D0-ONOFF";
    /** 11チャンネル */
    readonly num_11: "NRC_D11-ONOFF";
    /** 12チャンネル */
    readonly num_12: "NRC_D12-ONOFF";
    /** 元の画面 */
    readonly exit: "NRC_CANCEL-ONOFF";
    /** 消音 */
    readonly mute: "NRC_MUTE-ONOFF";
    /** チャンネル↑ */
    readonly ch_up: "NRC_CH_UP-ONOFF";
    /** チャンネル↓ */
    readonly ch_down: "NRC_CH_DOWN-ONOFF";
    /** 音量+ */
    readonly volume_up: "NRC_VOLUP-ONOFF";
    /** 音量- */
    readonly volume_down: "NRC_VOLDOWN-ONOFF";
    /** << スキップ */
    readonly skip_prev: "NRC_SKIP_PREV-ONOFF";
    /** スキップ >> */
    readonly skip_next: "NRC_SKIP_NEXT-ONOFF";
    /** 早戻し */
    readonly rewind: "NRC_REW-ONOFF";
    /** 早送り */
    readonly fast_forward: "NRC_FF-ONOFF";
    /** 録画 */
    readonly record: "NRC_REC-ONOFF";
    /** 停止 */
    readonly stop: "NRC_STOP-ONOFF";
    /** 一時停止 */
    readonly pause: "NRC_PAUSE-ONOFF";
    /** 再生/1.3倍速 */
    readonly play: "NRC_PLAY-ONOFF";
    /** 音声切替 */
    readonly mpx: "NRC_MPX-ONOFF";
    /** 節電視聴 */
    readonly eco: "NRC_ECO-ONOFF";
    /** ビエラリンク */
    readonly link: "NRC_VIERA_LINK-ONOFF";
    /** 30秒送り */
    readonly thirty_second_skip: "NRC_30S_SKIP-ONOFF";
    /** ガイド */
    readonly guide: "NRC_GUIDE-ONOFF";
    /** 2画面 */
    readonly split: "NRC_SPLIT-ONOFF";
    /** 字幕 */
    readonly cc: "NRC_CC-ONOFF";
    /** オフタイマー */
    readonly off_timer: "NRC_OFFTIMER-ONOFF";
    /** TV */
    readonly tv: "MACRO_TV-ONOFF";
    /** HDMI1 */
    readonly hdmi1: "MACRO_VIDEO-ONOFF";
    /** HDMI2 */
    readonly hdmi2: "MACRO_HDMI2-ONOFF";
    /** HDMI3 */
    readonly hdmi3: "MACRO_HDMI3-ONOFF";
    /** ビデオ */
    readonly video: "MACRO_HDMI4-ONOFF";
};
declare type VieraKey = typeof VieraKey[keyof typeof VieraKey];
export { VieraKey };
