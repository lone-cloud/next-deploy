import { join } from 'path';
import fse from 'fs-extra';
import execa from 'execa';
import Builder, { DEFAULT_LAMBDA_CODE_DIR, API_LAMBDA_CODE_DIR } from '../../src/builder';
import { cleanupDir, removeNewLineChars } from '../test-utils';
import { OriginRequestDefaultHandlerManifest, OriginRequestApiHandlerManifest } from '../../types';

jest.mock('execa');

describe('Builder Tests', () => {
  let fseRemoveSpy: jest.SpyInstance;
  let fseEmptyDirSpy: jest.SpyInstance;
  let defaultBuildManifest: OriginRequestDefaultHandlerManifest;
  let apiBuildManifest: OriginRequestApiHandlerManifest;

  const fixturePath = join(__dirname, './simple-app-fixture');
  const outputDir = join(fixturePath, '.test_sls_next_output');

  beforeEach(async () => {
    const mockExeca = execa as jest.Mock;
    mockExeca.mockResolvedValueOnce();

    fseRemoveSpy = jest.spyOn(fse, 'remove').mockImplementation(() => {
      return;
    });
    fseEmptyDirSpy = jest.spyOn(fse, 'emptyDir');

    const builder = new Builder(fixturePath, outputDir);
    await builder.build();

    defaultBuildManifest = await fse.readJSON(
      join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/manifest.json`)
    );

    apiBuildManifest = await fse.readJSON(join(outputDir, `${API_LAMBDA_CODE_DIR}/manifest.json`));
  });

  afterEach(() => {
    fseEmptyDirSpy.mockRestore();
    fseRemoveSpy.mockRestore();
    return cleanupDir(outputDir);
  });

  describe('Cleanup', () => {
    it('.next directory is emptied except for cache/ folder', () => {
      expect(fseRemoveSpy).toBeCalledWith(join(fixturePath, '.next/serverless'));
      expect(fseRemoveSpy).toBeCalledWith(join(fixturePath, '.next/prerender-manifest.json'));
      expect(fseRemoveSpy).not.toBeCalledWith(join(fixturePath, '.next/cache'));
    });

    it('output directory is cleaned-up before building', () => {
      expect(fseEmptyDirSpy).toBeCalledWith(
        expect.stringContaining(join('.test_sls_next_output', 'default-lambda'))
      );
      expect(fseEmptyDirSpy).toBeCalledWith(
        expect.stringContaining(join('.test_sls_next_output', 'api-lambda'))
      );
    });
  });

  describe('Default Handler Manifest', () => {
    it('adds full manifest', () => {
      const {
        buildId,
        publicFiles,
        pages: {
          ssr: { dynamic, nonDynamic },
          html,
        },
      } = defaultBuildManifest;

      expect(removeNewLineChars(buildId)).toEqual('test-build-id');
      expect(dynamic).toEqual({
        '/customers/:catchAll*': {
          file: 'pages/customers/[...catchAll].js',
          regex: expect.any(String),
        },
      });

      expect(nonDynamic).toEqual({
        '/customers/new': 'pages/customers/new.js',
        '/': 'pages/index.js',
        '/_app': 'pages/_app.js',
        '/_document': 'pages/_document.js',
      });

      expect(html).toEqual({
        nonDynamic: {
          '/404': 'pages/404.html',
          '/terms': 'pages/terms.html',
          '/about': 'pages/about.html',
        },
        dynamic: {
          '/blog/:post': {
            file: 'pages/blog/[post].html',
            regex: expect.any(String),
          },
        },
      });

      expect(publicFiles).toEqual({
        '/favicon.ico': 'favicon.ico',
        '/sub/image.png': 'sub/image.png',
        '/sw.js': 'sw.js',
      });
    });
  });

  describe('API Handler Manifest', () => {
    it('adds full api manifest', () => {
      const {
        apis: { dynamic, nonDynamic },
      } = apiBuildManifest;

      expect(nonDynamic).toEqual({
        '/api/customers': 'pages/api/customers.js',
        '/api/customers/new': 'pages/api/customers/new.js',
      });
      expect(dynamic).toEqual({
        '/api/customers/:id': {
          file: 'pages/api/customers/[id].js',
          regex: expect.any(String),
        },
      });
    });
  });

  describe('Default Handler Artifact Files', () => {
    it('copies build files', async () => {
      expect.assertions(7);

      const files = await fse.readdir(join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}`));
      const pages = await fse.readdir(join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages`));
      const customerPages = await fse.readdir(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages/customers`)
      );
      const apiDirExists = await fse.pathExists(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/pages/api`)
      );
      const compatLayerIncluded = await fse.pathExists(
        join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/compat.js`)
      );

      expect(files).toEqual([
        'compat.js',
        'index.js',
        'manifest.json',
        'pages',
        'prerender-manifest.json',
      ]);

      expect(compatLayerIncluded).toEqual(true);

      // api pages should not be included in the default lambda
      expect(apiDirExists).toEqual(false);

      // HTML Prerendered pages or JSON static props files
      // should not be included in the default lambda
      expect(pages).not.toContain(['blog.json']);
      expect(pages).not.toContain(['about.html', 'terms.html']);

      expect(pages).toEqual(['_error.js', 'blog.js', 'customers', 'index.js']);
      expect(customerPages).toEqual(['[...catchAll].js', '[id].js', '[post].js', 'new.js']);
    });
  });

  describe('API Handler Artifact Files', () => {
    it('copies build files', async () => {
      expect.assertions(3);

      const files = await fse.readdir(join(outputDir, `${API_LAMBDA_CODE_DIR}`));
      const pages = await fse.readdir(join(outputDir, `${API_LAMBDA_CODE_DIR}/pages`));

      const compatLayerIncluded = await fse.pathExists(
        join(outputDir, `${API_LAMBDA_CODE_DIR}/compat.js`)
      );

      expect(compatLayerIncluded).toEqual(true);
      expect(files).toEqual(['compat.js', 'index.js', 'manifest.json', 'pages']);
      expect(pages).toEqual(['api']);
    });
  });
});
