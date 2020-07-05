declare module '@serverless/core' {
  export class Component {
    load(modulePath: string, moduleName?: string): any;
    save(): void;
    state: any;
    context: {
      resourceId(): string;
      status(message: string): void;
      debug(message: string): void;
      log(message: string): void;
      credentials: {
        aws: Credentials;
      };
      instance: {
        debugMode: boolean;
      };
    };
  }

  export const utils: Utils;

  type Utils = {
    dirExists(path: string): boolean;
    hashFile(path: string): string;
    isArchivePath(path: string): boolean;
    sleep(time: number): void;
  };
  type Credentials = {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}
