import { Credentials, S3 } from 'aws-sdk';

type AwsS3Inputs = {
  name?: string;
  region?: string;
  file?: string;
  dir?: string;
  key?: string;
  zip?: string;
  accelerated?: boolean;
  cacheControl?: S3.CacheControl;
  keyPrefix?: string;
  cors?: S3.CORSConfiguration;
};

type PublicDirectoryCache =
  | boolean
  | {
      test?: string;
      value?: string;
    };

type SyncStageStateDirectoryOptions = Stage & {
  nextConfigDir: string;
  credentials: Credentials;
  syncTo?: boolean;
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

type DownloadFileOptions = {
  s3Key: string;
};

type ListFileOptions = {
  s3Key: string;
};

type SetVersioningOptions = {
  versioned?: boolean;
};

type S3Client = {
  uploadFile: (options: UploadFileOptions) => Promise<S3.ManagedUpload.SendData>;
  listFiles: (options: ListFileOptions) => Promise<S3.ListObjectsV2Output>;
  downloadFile: (options: DownloadFileOptions) => Promise<S3.GetObjectOutput>;
  setVersioning: (options: SetVersioningOptions) => Promise<unknown>;
};
