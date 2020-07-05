declare module '@serverless/core' {
  import { Credentials } from 's3-static-assets/src/lib/s3';

  export class Component {
    load(modulePath: string, moduleName?: string): any;
    context: {
      credentials: {
        aws: Credentials;
      };
      instance: {
        debugMode: boolean;
      };
    };
  }
}
