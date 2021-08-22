"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VieraError = void 0;
class VieraError extends Error {
    constructor(response, errorCode, message) {
        super(message);
        this.response = response;
        this.errorCode = errorCode;
    }
}
exports.VieraError = VieraError;
//# sourceMappingURL=VieraError.js.map