# panasonic-viera-ts

Panasonic VIERA Client

## VIERAとペアリングし、appIdとencKeyを取得
```bash
node_modules/.bin/viera-auth-cli
```

## 利用方法
```ts
const client = new VieraClient('IP Address', {appId: 'appId', encKey: 'encKey'});

await client.connect();

const volume = await client.getVolume();
console.log(`現在の音量: ${volume}`);

await client.sendKey(VieraKey.power);

const apps = await client.getApps();
const targetApp = apps[0];
console.log(`アプリ ${targetApp.name} を起動します。`);
await client.launchApp(targetApp.productId);
```
