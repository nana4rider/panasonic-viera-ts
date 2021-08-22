import { AxiosResponse } from 'axios';
declare class VieraError extends Error {
    response: AxiosResponse<string>;
    errorCode: number;
    constructor(response: AxiosResponse<string>, errorCode: number, message: string);
}
export { VieraError };
