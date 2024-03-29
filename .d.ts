declare module '@serverless/core' {
  import { Credentials } from 'aws-sdk';
  export class Component {
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
        metrics: any;
      };
    };
  }

  export const utils: Utils;

  type Utils = {
    dirExists(path: string): boolean;
    fileExists(path: string): boolean;
    hashFile(path: string): string;
    isArchivePath(path: string): boolean;
    sleep(time: number): void;
    readFileIfExists(path: string): Promise<any>;
    randomId(): string;
    readFile(path: string): Promise<any>;
    writeFile(contextStatePath: string, state: Record<string, unknown>): Promise<any>;
  };
}

declare module 's3-stream-upload' {
  import { S3 } from 'aws-sdk';

  export default function (s3: S3, options: UploadStreamOptions): NodeJS.WritableStream;
}

declare module 'prettyoutput' {
  export default function (data: any, options?: any, indent?: number): string;
}

type UploadStreamOptions = {
  Bucket?: string;
  Key?: string;
  ContentType?: string;
  CacheControl?: string;
};

type BaseDeploymentOptions = {
  engine?: 'aws' | 'github';
  debug?: boolean;
  onPreDeploy?: () => Promise<void>;
  onPostDeploy?: () => Promise<void>;
  onShutdown?: () => Promise<void>;
  build?: BuildOptions;
  nextConfigDir?: string;
  domain?: string | string[];
  stage?: Stage;
};

type BuildOptions = {
  cwd?: string;
  cmd: string;
  args: string[];
};

type Stage = {
  bucketName: string;
  name: string;
  versioned?: boolean;
};
