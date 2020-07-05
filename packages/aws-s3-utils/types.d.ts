import { S3 } from 'aws-sdk';

type PublicDirectoryCache =
  | boolean
  | {
      test?: string;
      value?: string;
    };

type UploadStaticAssetsOptions = {
  bucketName: string;
  nextConfigDir: string;
  nextStaticDir?: string;
  credentials: Credentials;
  publicDirectoryCache?: PublicDirectoryCache;
};

type S3ClientFactoryOptions = {
  bucketName: string;
  credentials: Credentials;
};

type UploadFileOptions = {
  filePath: string;
  cacheControl?: string;
  s3Key?: string;
};

type S3Client = {
  uploadFile: (options: UploadFileOptions) => Promise<S3.ManagedUpload.SendData>;
};

type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};
