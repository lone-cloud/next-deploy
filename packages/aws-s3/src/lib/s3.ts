import fse from 'fs-extra';
import aws from 'aws-sdk';
import mime from 'mime-types';
import path from 'path';

import { S3ClientFactoryOptions, S3Client, UploadFileOptions } from '../../types';

const getMimeType = (filePath: string): string =>
  mime.lookup(path.basename(filePath)) || 'application/octet-stream';

export default async ({ bucketName, credentials }: S3ClientFactoryOptions): Promise<S3Client> => {
  let s3 = new aws.S3({ ...credentials });

  try {
    const { Status } = await s3
      .getBucketAccelerateConfiguration({
        Bucket: bucketName,
      })
      .promise();

    if (Status === 'Enabled') {
      s3 = new aws.S3({ ...credentials, useAccelerateEndpoint: true });
    }
  } catch (err) {
    console.warn(
      `Checking for bucket acceleration failed, falling back to non-accelerated S3 client. Err: ${err.message}`
    );
  }

  return {
    uploadFile: async (options: UploadFileOptions): Promise<aws.S3.ManagedUpload.SendData> => {
      const { filePath, cacheControl, s3Key } = options;

      const fileBody = await fse.readFile(filePath);

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
  };
};
