import nodeFileTrace, { NodeFileTraceReasons } from '@zeit/node-file-trace';
import execa from 'execa';
import {
  emptyDir,
  pathExists,
  readJSON,
  copy,
  writeJson,
  remove,
  readdir,
  readFile,
} from 'fs-extra';
import { join, resolve, sep, extname, relative, basename } from 'path';
import { pathToRegexp } from 'path-to-regexp';

import getAllFiles from './lib/getAllFilesInDirectory';
import { getSortedRoutes } from './lib/sortedRoutes';
import { OriginRequestHandlerManifest } from '../types';
import expressifyDynamicRoute from './lib/expressifyDynamicRoute';
import createServerlessConfig from './lib/createServerlessConfig';

export const REQUEST_LAMBDA_CODE_DIR = 'request-lambda';

const pathToPosix = (path: string): string => path.replace(/\\/g, '/');
const normalizeNodeModules = (path: string): string => path.substring(path.indexOf('node_modules'));
// Identify /[param]/ in route string
const isDynamicRoute = (route: string): boolean => /\/\[[^\/]+?\](?=\/|$)/.test(route);
const pathToRegexStr = (path: string): string =>
  pathToRegexp(path)
    .toString()
    .replace(/\/(.*)\/\i/, '$1');

const defaultBuildOptions = {
  args: [],
  cwd: process.cwd(),
  cmd: './node_modules/.bin/next',
};

class Builder {
  nextConfigDir: string;
  dotNextDir: string;
  serverlessDir: string;
  outputDir: string;
  buildOptions: BuildOptions = defaultBuildOptions;

  constructor(nextConfigDir: string, outputDir: string, buildOptions?: BuildOptions) {
    this.nextConfigDir = resolve(nextConfigDir);
    this.dotNextDir = join(this.nextConfigDir, '.next');
    this.serverlessDir = join(this.dotNextDir, 'serverless');
    this.outputDir = outputDir;

    if (buildOptions) {
      this.buildOptions = buildOptions;
    }
  }

  async readPublicFiles(): Promise<string[]> {
    const dirExists = await pathExists(join(this.nextConfigDir, 'public'));
    if (dirExists) {
      return getAllFiles(join(this.nextConfigDir, 'public'))
        .map((e) => e.replace(this.nextConfigDir, ''))
        .map((e) => e.split(sep).slice(2).join('/'));
    } else {
      return [];
    }
  }

  async readPagesManifest(): Promise<{ [key: string]: string }> {
    const path = join(this.serverlessDir, 'pages-manifest.json');
    const hasServerlessPageManifest = await pathExists(path);

    if (!hasServerlessPageManifest) {
      return Promise.reject(
        "pages-manifest not found. Check if `next.config.js` target is set to 'serverless'"
      );
    }

    const pagesManifest = await readJSON(path);
    const pagesManifestWithoutDynamicRoutes = Object.keys(pagesManifest).reduce(
      (acc: { [key: string]: string }, route: string) => {
        if (isDynamicRoute(route)) {
          return acc;
        }

        acc[route] = pagesManifest[route];
        return acc;
      },
      {}
    );

    const dynamicRoutedPages = Object.keys(pagesManifest).filter(isDynamicRoute);
    const sortedDynamicRoutedPages = getSortedRoutes(dynamicRoutedPages);
    const sortedPagesManifest = pagesManifestWithoutDynamicRoutes;

    sortedDynamicRoutedPages.forEach(
      (route) => (sortedPagesManifest[route] = pagesManifest[route])
    );

    return sortedPagesManifest;
  }

  copyLambdaHandlerDependencies(
    fileList: string[],
    reasons: NodeFileTraceReasons,
    handlerDirectory: string
  ): Promise<void>[] {
    return (
      fileList
        // exclude "initial" files from lambda artifact. These are just the pages themselves which are copied over separately
        .filter(
          (file) => file !== 'package.json' && (!reasons[file] || reasons[file].type !== 'initial')
        )
        .map((filePath: string) => {
          const resolvedFilePath = resolve(filePath);
          const dst = normalizeNodeModules(relative(this.serverlessDir, resolvedFilePath));
          return copy(resolvedFilePath, join(this.outputDir, handlerDirectory, dst));
        })
    );
  }

  async buildRequestLambda(buildManifest: OriginRequestHandlerManifest): Promise<void[]> {
    const ignoreAppAndDocumentPages = (page: string): boolean => {
      const pageBasename = basename(page);
      return pageBasename !== '_app.js' && pageBasename !== '_document.js';
    };

    const allServerProcessablePages = [
      ...Object.values(buildManifest.pages.ssr.nonDynamic),
      ...Object.values(buildManifest.pages.ssr.dynamic).map((entry) => entry.file),
      ...Object.values(buildManifest.pages.apis.nonDynamic),
      ...Object.values(buildManifest.pages.apis.dynamic).map((entry) => entry.file),
    ].filter(ignoreAppAndDocumentPages);

    const ssrPages = Object.values(allServerProcessablePages).map((pageFile) =>
      join(this.serverlessDir, pageFile)
    );

    const { fileList, reasons } = await nodeFileTrace(ssrPages, {
      base: process.cwd(),
    });

    const copyTraces = this.copyLambdaHandlerDependencies(
      fileList,
      reasons,
      REQUEST_LAMBDA_CODE_DIR
    );

    return Promise.all([
      ...copyTraces,
      copy(
        require.resolve('@next-deploy/aws-lambda-builder/dist/request-handler.js'),
        join(this.outputDir, REQUEST_LAMBDA_CODE_DIR, 'index.js')
      ),
      copy(
        require.resolve('@next-deploy/aws-lambda-builder/dist/compat.js'),
        join(this.outputDir, REQUEST_LAMBDA_CODE_DIR, 'compat.js')
      ),
      writeJson(join(this.outputDir, REQUEST_LAMBDA_CODE_DIR, 'manifest.json'), buildManifest),
      copy(
        join(this.serverlessDir, 'pages'),
        join(this.outputDir, REQUEST_LAMBDA_CODE_DIR, 'pages'),
        {
          filter: (file: string) => extname(file) !== '.html' && extname(file) !== '.json',
        }
      ),
      copy(
        join(this.dotNextDir, 'prerender-manifest.json'),
        join(this.outputDir, REQUEST_LAMBDA_CODE_DIR, 'prerender-manifest.json')
      ),
    ]);
  }

  async prepareBuildManifest(): Promise<OriginRequestHandlerManifest> {
    const pagesManifest = await this.readPagesManifest();
    const buildId = await readFile(join(this.dotNextDir, 'BUILD_ID'), 'utf-8');
    const defaultBuildManifest: OriginRequestHandlerManifest = {
      buildId,
      pages: {
        ssr: {
          dynamic: {},
          nonDynamic: {},
        },
        html: {
          dynamic: {},
          nonDynamic: {},
        },
        apis: {
          dynamic: {},
          nonDynamic: {},
        },
      },
      publicFiles: {},
    };

    const ssrPages = defaultBuildManifest.pages.ssr;
    const htmlPages = defaultBuildManifest.pages.html;
    const apiPages = defaultBuildManifest.pages.apis;

    const isHtmlPage = (path: string): boolean => path.endsWith('.html');
    const isApiPage = (path: string): boolean => path.startsWith('pages/api');

    Object.entries(pagesManifest).forEach(([route, pageFile]) => {
      const dynamicRoute = isDynamicRoute(route);
      const expressRoute = dynamicRoute ? expressifyDynamicRoute(route) : null;

      if (isHtmlPage(pageFile)) {
        if (dynamicRoute) {
          const route = expressRoute as string;
          htmlPages.dynamic[route] = {
            file: pageFile,
            regex: pathToRegexStr(route),
          };
        } else {
          htmlPages.nonDynamic[route] = pageFile;
        }
      } else if (isApiPage(pageFile)) {
        if (dynamicRoute) {
          const route = expressRoute as string;
          apiPages.dynamic[route] = {
            file: pageFile,
            regex: pathToRegexStr(route),
          };
        } else {
          apiPages.nonDynamic[route] = pageFile;
        }
      } else if (dynamicRoute) {
        const route = expressRoute as string;
        ssrPages.dynamic[route] = {
          file: pageFile,
          regex: pathToRegexStr(route),
        };
      } else {
        ssrPages.nonDynamic[route] = pageFile;
      }
    });

    const publicFiles = await this.readPublicFiles();

    publicFiles.forEach((pf) => (defaultBuildManifest.publicFiles[`/${pf}`] = pf));

    return defaultBuildManifest;
  }

  async cleanupDotNext(): Promise<void> {
    const exists = await pathExists(this.dotNextDir);

    if (exists) {
      const fileItems = await readdir(this.dotNextDir);

      await Promise.all(
        fileItems
          .filter(
            (fileItem) => fileItem !== 'cache' // avoid deleting the cache folder as that would lead to slow builds!
          )
          .map((fileItem) => remove(join(this.dotNextDir, fileItem)))
      );
    }
  }

  async build(debug?: (message: string) => void): Promise<void> {
    const { cmd, args, cwd } = { ...defaultBuildOptions, ...this.buildOptions };

    await this.cleanupDotNext();

    await emptyDir(join(this.outputDir, REQUEST_LAMBDA_CODE_DIR));

    const { restoreUserConfig } = await createServerlessConfig(cwd, join(this.nextConfigDir));

    try {
      if (debug) {
        const { stdout: nextVersion } = await execa(cmd, ['--version'], {
          cwd,
        });

        debug(`Starting a new build with ${nextVersion}`);

        console.log();
      }

      const subprocess = execa(cmd, args, {
        cwd,
      });

      if (debug && subprocess.stdout) {
        subprocess.stdout.pipe(process.stdout);
      }

      await subprocess;
    } finally {
      await restoreUserConfig();
    }

    const defaultBuildManifest = await this.prepareBuildManifest();

    await this.buildRequestLambda(defaultBuildManifest);
  }
}

export default Builder;
