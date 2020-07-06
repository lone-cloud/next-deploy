import { createComponent, assertHasCacheBehavior } from './test-utils';

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

  it('creates distribution with lambda associations for each event type', async () => {
    await component.default({
      origins: [
        {
          url: 'https://exampleorigin.com',
          pathPatterns: {
            '/some/path': {
              ttl: 10,
              'lambda@edge': {
                'viewer-request': 'arn:aws:lambda:us-east-1:123:function:viewerRequestFunction',
                'origin-request': 'arn:aws:lambda:us-east-1:123:function:originRequestFunction',
                'origin-response': 'arn:aws:lambda:us-east-1:123:function:originResponseFunction',
                'viewer-response': 'arn:aws:lambda:us-east-1:123:function:viewerResponseFunction',
              },
            },
          },
        },
      ],
    });

    assertHasCacheBehavior(mockCreateDistribution, {
      PathPattern: '/some/path',
      LambdaFunctionAssociations: {
        Quantity: 4,
        Items: [
          {
            EventType: 'viewer-request',
            LambdaFunctionARN: 'arn:aws:lambda:us-east-1:123:function:viewerRequestFunction',
            IncludeBody: true,
          },
          {
            EventType: 'origin-request',
            LambdaFunctionARN: 'arn:aws:lambda:us-east-1:123:function:originRequestFunction',
            IncludeBody: true,
          },
          {
            EventType: 'origin-response',
            LambdaFunctionARN: 'arn:aws:lambda:us-east-1:123:function:originResponseFunction',
            IncludeBody: true,
          },
          {
            EventType: 'viewer-response',
            LambdaFunctionARN: 'arn:aws:lambda:us-east-1:123:function:viewerResponseFunction',
            IncludeBody: true,
          },
        ],
      },
    });

    expect(mockCreateDistribution.mock.calls[0][0]).toMatchSnapshot();
  });

  it('throws error when event type provided is not valid', async () => {
    expect.assertions(1);

    try {
      await component.default({
        origins: [
          {
            url: 'https://exampleorigin.com',
            pathPatterns: {
              '/some/path': {
                ttl: 10,
                'lambda@edge': {
                  'invalid-eventtype':
                    'arn:aws:lambda:us-east-1:123:function:viewerRequestFunction',
                },
              },
            },
          },
        ],
      });
    } catch (err) {
      expect(err.message).toEqual(
        '"invalid-eventtype" is not a valid lambda trigger. See https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-cloudfront-trigger-events.html for valid event types.'
      );
    }
  });
});
