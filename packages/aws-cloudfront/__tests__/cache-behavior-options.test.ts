import { createComponent } from './test-utils';

import { mockCreateDistribution, mockCreateDistributionPromise } from 'aws-sdk';
import CloudFrontComponent from '../serverless';

jest.mock('aws-sdk', () => require('../__mocks__/aws-sdk.mock'));

describe('Input origin as a custom url', () => {
  let component: CloudFrontComponent;

  beforeEach(async () => {
    mockCreateDistributionPromise.mockResolvedValueOnce({
      Distribution: {
        Id: 'distribution123',
      },
    });

    component = await createComponent();
  });

  it('creates distribution with custom default behavior options', async () => {
    await component.default({
      defaults: {
        ttl: 0,
        forward: {
          headers: ['Accept', 'Accept-Language'],
          cookies: 'all',
          queryString: true,
          queryStringCacheKeys: ['query'],
        },
        allowedHttpMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
        viewerProtocolPolicy: 'https-only',
        smoothStreaming: true,
        compress: true,
        fieldLevelEncryptionId: '123',
      },
      origins: ['https://mycustomorigin.com'],
    });

    expect(mockCreateDistribution.mock.calls[0][0]).toMatchSnapshot();
  });

  it('creates distribution with custom behavior options', async () => {
    await component.default({
      defaults: {
        ttl: 0,
      },
      origins: [
        {
          url: 'https://mycustomorigin.com',
          pathPatterns: {
            '/sample/path': {
              ttl: 0,
              forward: {
                headers: 'all',
                cookies: ['auth-token'],
                queryString: true,
              },
              allowedHttpMethods: ['GET', 'HEAD'],
              viewerProtocolPolicy: 'redirect-to-https',
              compress: false,
              fieldLevelEncryptionId: '321',
            },
          },
        },
      ],
    });

    expect(mockCreateDistribution.mock.calls[0][0]).toMatchSnapshot();
  });
});
