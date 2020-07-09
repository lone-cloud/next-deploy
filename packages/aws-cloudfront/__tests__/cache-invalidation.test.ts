import { CloudFront, mockCreateInvalidation } from 'aws-sdk';
import createInvalidation, { ALL_FILES_PATH } from '../src/lib/createInvalidation';

jest.mock('aws-sdk', () => require('./aws-sdk.mock'));

const invalidate = (options = {}): Promise<CloudFront.CreateInvalidationResult> => {
  return createInvalidation({
    ...options,
    distributionId: 'fake-distribution-id',
    credentials: {
      accessKeyId: 'fake-access-key',
      secretAccessKey: 'fake-secret-key',
      sessionToken: 'fake-session-token',
    },
  });
};

describe('Cache invalidation tests', () => {
  it('passes credentials to CloudFront client', async () => {
    await invalidate();

    expect(CloudFront).toBeCalledWith({
      credentials: {
        accessKeyId: 'fake-access-key',
        secretAccessKey: 'fake-secret-key',
        sessionToken: 'fake-session-token',
      },
    });
  });

  it('invalidates CloudFront distribution', async () => {
    await invalidate();

    expect(mockCreateInvalidation).toBeCalledWith({
      DistributionId: 'fake-distribution-id',
      InvalidationBatch: {
        CallerReference: expect.stringMatching(/^\d+$/),
        Paths: {
          Quantity: 1,
          Items: [ALL_FILES_PATH],
        },
      },
    });
  });

  it('invalidates specified paths', async () => {
    const paths = ['/static/page1', '/static/page2'];
    await invalidate({ paths });

    expect(mockCreateInvalidation).toBeCalledWith({
      DistributionId: 'fake-distribution-id',
      InvalidationBatch: {
        CallerReference: expect.stringMatching(/^\d+$/),
        Paths: {
          Quantity: 2,
          Items: paths,
        },
      },
    });
  });
});
