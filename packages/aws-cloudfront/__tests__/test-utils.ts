import fse from 'fs-extra';
import os from 'os';
import path from 'path';

import CloudFrontComponent from '../serverless';

export const createComponent = async () => {
  // mock to prevent jest snapshots changing every time
  Date.now = () => 1566599541192;

  // create tmp folder to avoid state collisions between tests
  const tmpFolder = await fse.mkdtemp(path.join(os.tmpdir(), 'test-'));

  const component = new CloudFrontComponent('TestCloudFront', {
    stateRoot: tmpFolder,
  });

  await component.init();

  return component;
};

export const assertHasCacheBehavior = (spy, cacheBehavior) => {
  expect(spy).toBeCalledWith(
    expect.objectContaining({
      DistributionConfig: expect.objectContaining({
        CacheBehaviors: expect.objectContaining({
          Items: [expect.objectContaining(cacheBehavior)],
        }),
      }),
    })
  );
};

export const assertHasOrigin = (spy, origin) => {
  expect(spy).toBeCalledWith(
    expect.objectContaining({
      DistributionConfig: expect.objectContaining({
        Origins: expect.objectContaining({
          Items: [expect.objectContaining(origin)],
        }),
      }),
    })
  );
};
