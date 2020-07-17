import { readFile } from 'fs-extra';
import { S3 } from 'aws-sdk';

import {
  S3ClientFactoryOptions,
  S3Client,
  UploadFileOptions,
  ListFileOptions,
  SetVersioningOptions,
} from '../../types';
import { getMimeType } from './utils';

export default async ({ bucketName, credentials }: S3ClientFactoryOptions): Promise<S3Client> => {
  let s3 = new S3({ ...credentials });

  try {
    const { Status } = await s3
      .getBucketAccelerateConfiguration({
        Bucket: bucketName,
      })
      .promise();

    if (Status === 'Enabled') {
      s3 = new S3({ ...credentials, useAccelerateEndpoint: true });
    }
  } catch (err) {
    console.warn(
      `Checking for bucket acceleration failed, falling back to non-accelerated S3 client. Err: ${err.message}`
    );
  }

  return {
    uploadFile: async ({
      filePath,
      cacheControl,
      s3Key,
    }: UploadFileOptions): Promise<S3.ManagedUpload.SendData> => {
      const fileBody = await readFile(filePath);

      return s3
        .upload({
          Bucket: bucketName,
          Key: s3Key || filePath,
          Body: fileBody,
          ContentType: getMimeType(filePath),
          CacheControl: cacheControl || undefined,
        })
        .promise();
    },
    listFiles: async ({ s3Key }: ListFileOptions) => {
      return s3
        .listObjectsV2({
          Bucket: bucketName,
          Prefix: s3Key,
        })
        .promise();
    },
    downloadFile: async ({ s3Key }: ListFileOptions) => {
      return s3
        .getObject({
          Bucket: bucketName,
          Key: s3Key,
        })
        .promise();
    },
    setVersioning: async ({ versioned }: SetVersioningOptions) => {
      return s3
        .putBucketVersioning({
          Bucket: bucketName,
          VersioningConfiguration: {
            Status: versioned ? 'Enabled' : 'Suspended',
          },
        })
        .promise();
    },
  };
};
