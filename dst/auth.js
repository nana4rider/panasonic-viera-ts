#!/usr/bin/env node
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
const commander_1 = require("commander");
const readline_1 = require("readline");
const VieraClient_1 = require("./lib/VieraClient");
const program = commander_1.createCommand();
program.exitOverride();
const rl = readline_1.createInterface({
    input: process.stdin,
    output: process.stdout
});
function question(message) {
    return new Promise(resolve => rl.question(message + ' > ', resolve));
}
void (() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const host = yield question('Input VIERA IP Address');
        const viera = new VieraClient_1.VieraClient(host);
        yield viera.displayPinCode();
        const pinCode = yield question('Input PinCode');
        const auth = yield viera.requestAuth(pinCode);
        rl.write(`host: ${host}\n`);
        rl.write(`appId: ${auth.appId}\n`);
        rl.write(`encKey: ${auth.encKey}\n`);
    }
    catch (e) {
        rl.write(`error: ${e.message}\n`);
    }
    process.exit(0);
}))();
//# sourceMappingURL=auth.js.map