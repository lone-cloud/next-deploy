import fse from 'fs-extra';
import path from 'path';

const BUILD_DIR = '.serverless_nextjs';

export const cleanupFixtureDirectory = (fixtureDir: string) => (): Promise<void> => {
  return fse.remove(path.join(fixtureDir, BUILD_DIR));
};
