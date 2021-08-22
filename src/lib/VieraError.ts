import { AxiosResponse } from 'axios';

class VieraError extends Error {
  constructor(public response: AxiosResponse<string>, public errorCode: number, message: string) {
    super(message);
  }
}

export { VieraError };
