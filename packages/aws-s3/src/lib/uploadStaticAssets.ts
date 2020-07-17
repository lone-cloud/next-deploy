import { S3 } from 'aws-sdk';
import path from 'path';
import { readJSON, pathExists } from 'fs-extra';
import { PrerenderManifest } from 'next/dist/build/index';

import S3ClientFactory from './s3';
import { pathToPosix, readDirectoryFiles, filterOutDirectories } from './utils';
import getPublicAssetCacheControl from './getPublicAssetCacheControl';
import { UploadStaticAssetsOptions, PublicDirectoryCache } from '../../types';

export const SERVER_CACHE_CONTROL_HEADER = 'public, max-age=0, s-maxage=2678400, must-revalidate';
export const IMMUTABLE_CACHE_CONTROL_HEADER = 'public, max-age=31536000, immutable';

const uploadStaticAssets = async ({
  bucketName,
  nextConfigDir,
  nextStaticDir = nextConfigDir,
  publicDirectoryCache,
  credentials,
}: UploadStaticAssetsOptions): Promise<S3.ManagedUpload.SendData[]> => {
  const s3 = await S3ClientFactory({
    bucketName,
    credentials,
  });

  const dotNextDirectory = path.join(nextConfigDir, '.next');
  const buildStaticFiles = await readDirectoryFiles(path.join(dotNextDirectory, 'static'));

  const buildStaticFileUploads = buildStaticFiles
    .filter(filterOutDirectories)
    .map(async (fileItem) => {
      const s3Key = pathToPosix(
        path.relative(path.resolve(nextConfigDir), fileItem.path).replace(/^.next/, '_next')
      );

      return s3.uploadFile({
        s3Key,
        filePath: fileItem.path,
        cacheControl: IMMUTABLE_CACHE_CONTROL_HEADER,
      });
    });

  const pagesManifest = await readJSON(
    path.join(dotNextDirectory, 'serverless/pages-manifest.json')
  );

  const htmlPageUploads = Object.values(pagesManifest)
    .filter((pageFile) => (pageFile as string).endsWith('.html'))
    .map((relativePageFilePath) => {
      const pageFilePath = pathToPosix(
        path.join(dotNextDirectory, `serverless/${relativePageFilePath}`)
      );

      return s3.uploadFile({
        s3Key: `static-pages/${(relativePageFilePath as string).replace(/^pages\//, '')}`,
        filePath: pageFilePath,
        cacheControl: SERVER_CACHE_CONTROL_HEADER,
      });
    });

  const prerenderManifest: PrerenderManifest = await readJSON(
    path.join(dotNextDirectory, 'prerender-manifest.json')
  );

  const prerenderManifestJSONPropFileUploads = Object.keys(prerenderManifest.routes).map((key) => {
    const pageFilePath = pathToPosix(
      path.join(
        dotNextDirectory,
        `serverless/pages/${key.endsWith('/') ? `${key}index.json` : `${key}.json`}`
      )
    );

    return s3.uploadFile({
      s3Key: prerenderManifest.routes[key].dataRoute.slice(1),
      filePath: pageFilePath,
    });
  });

  const prerenderManifestHTMLPageUploads = Object.keys(prerenderManifest.routes).map((key) => {
    const relativePageFilePath = key.endsWith('/')
      ? path.posix.join(key, 'index.html')
      : `${key}.html`;

    const pageFilePath = pathToPosix(
      path.join(dotNextDirectory, `serverless/pages/${relativePageFilePath}`)
    );

    return s3.uploadFile({
      s3Key: path.posix.join('static-pages', relativePageFilePath),
      filePath: pageFilePath,
      cacheControl: SERVER_CACHE_CONTROL_HEADER,
    });
  });

  const uploadPublicOrStaticDirectory = async (
    directory: 'public' | 'static',
    publicDirectoryCache?: PublicDirectoryCache
  ): Promise<Promise<S3.ManagedUpload.SendData>[]> => {
    const directoryPath = path.join(nextStaticDir, directory);
    if (!(await pathExists(directoryPath))) {
      return Promise.resolve([]);
    }

    const files = await readDirectoryFiles(directoryPath);

    return files.filter(filterOutDirectories).map((fileItem) =>
      s3.uploadFile({
        filePath: fileItem.path,
        s3Key: pathToPosix(path.relative(path.resolve(nextStaticDir), fileItem.path)),
        cacheControl: getPublicAssetCacheControl(fileItem.path, publicDirectoryCache),
      })
    );
  };

  const publicDirUploads = await uploadPublicOrStaticDirectory('public', publicDirectoryCache);
  const staticDirUploads = await uploadPublicOrStaticDirectory('static', publicDirectoryCache);

  const allUploads = [
    ...buildStaticFileUploads, // .next/static
    ...htmlPageUploads, // prerendered HTML pages
    ...prerenderManifestJSONPropFileUploads, // SSG JSON files
    ...prerenderManifestHTMLPageUploads, // SSG HTML files
    ...publicDirUploads, // app public dir
    ...staticDirUploads, // app static dir
  ];

  return Promise.all(allUploads);
};

export default uploadStaticAssets;
