declare module 'smartapi-javascript' {
  export class SmartConnect {
    constructor(config: { api_key: string });
    generateSession(clientCode: string, password: string,totp: string): Promise<any>;
    getProfile(): Promise<any>;
  }

  export class SmartWebSocketV2 {
    constructor(config: {
      jwttoken: string;
      apikey: string;
      clientcode: string;
      feedtype: string;
    });
    connect(): Promise<void>;
    fetchData(params: {
      correlationID: string;
      action: number;
      mode: number;
      exchangeType: number;
      tokens: string[];
    }): void;
    on(event: 'tick' | 'error' | 'close', callback: (data: any) => void): void;
    close(): void;
  }
}
