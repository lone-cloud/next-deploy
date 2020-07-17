import { S3 } from 'aws-sdk';
import path from 'path';
import { writeFile } from 'fs-extra';

import S3ClientFactory from './s3';
import { SyncStageStateDirectoryOptions } from '../../types';
import { pathToPosix, readDirectoryFiles, filterOutDirectories } from './utils';

const STATE_ROOT = '.next-deploy';

const syncStageStateDirectory = async ({
  name: stage,
  bucketName,
  credentials,
  nextConfigDir,
  syncTo,
  versioned,
}: SyncStageStateDirectoryOptions): Promise<any> => {
  const s3 = await S3ClientFactory({
    bucketName,
    credentials,
  });
  const stateRootDirectory = path.join(nextConfigDir, STATE_ROOT);

  if (syncTo) {
    const stateRootDirectoryFiles = await readDirectoryFiles(stateRootDirectory);

    const buildStateRootDirectoryFilesUploads = stateRootDirectoryFiles
      .filter(filterOutDirectories)
      .map(async (fileItem) => {
        const s3Key = pathToPosix(path.relative(path.resolve(nextConfigDir), fileItem.path));

        return s3.uploadFile({
          s3Key: `${stage}/${s3Key}`,
          filePath: fileItem.path,
        });
      });

    return Promise.all([...buildStateRootDirectoryFilesUploads]);
  } else {
    const files: { name: string; data: S3.GetObjectOutput }[] = [];

    if (versioned !== undefined) {
      await s3.setVersioning({ versioned });
    }

    const bucketFiles = await s3.listFiles({
      s3Key: stage,
    });

    for (const file of bucketFiles.Contents || []) {
      if (file.Key) {
        const fileData = await s3.downloadFile({ s3Key: file.Key });
        files.push({ name: file.Key.replace(`${stage}/`, ''), data: fileData });
      }
    }

    for (const { name, data } of files || []) {
      if (data.Body) {
        await writeFile(name, data.Body.toString());
      }
    }
  }
};

export default syncStageStateDirectory;
