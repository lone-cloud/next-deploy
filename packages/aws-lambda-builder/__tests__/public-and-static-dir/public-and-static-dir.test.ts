import execa from 'execa';
import fse, { readJSON } from 'fs-extra';
import { join } from 'path';
import Builder, { DEFAULT_LAMBDA_CODE_DIR } from '../../src/builder';
import { cleanupDir } from '../test-utils';
import { OriginRequestDefaultHandlerManifest } from '../../types';

jest.mock('execa');

describe('When public and static directories do not exist', () => {
  let defaultBuildManifest: OriginRequestDefaultHandlerManifest;
  let fseRemoveSpy: jest.SpyInstance;

  const fixturePath = join(__dirname, './app-with-no-static-or-public-dir-fixture');
  const outputDir = join(fixturePath, '.test_sls_next_output');

  beforeEach(async () => {
    const mockExeca = execa as jest.Mock;
    mockExeca.mockResolvedValueOnce();
    fseRemoveSpy = jest.spyOn(fse, 'remove').mockImplementation(() => {
      return;
    });

    const builder = new Builder(fixturePath, outputDir);
    await builder.build();

    defaultBuildManifest = await readJSON(
      join(outputDir, `${DEFAULT_LAMBDA_CODE_DIR}/manifest.json`)
    );
  });

  afterEach(() => {
    fseRemoveSpy.mockRestore();
    return cleanupDir(outputDir);
  });

  it('does not put any public files in the build manifest', async () => {
    expect(defaultBuildManifest.publicFiles).toEqual({});
  });
});
