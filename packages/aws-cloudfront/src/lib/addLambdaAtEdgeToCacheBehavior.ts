import { LambdaAtEdgeConfig, LambdaAtEdgeType } from '../../types';

const validLambdaTriggers = [
  'viewer-request',
  'origin-request',
  'origin-response',
  'viewer-response',
];

const triggersAllowedBody = ['viewer-request', 'origin-request'];

const makeCacheItem = (eventType: string, lambdaConfig: LambdaAtEdgeType) => {
  let arn, includeBody;
  if (typeof lambdaConfig === 'string') {
    arn = lambdaConfig;
    includeBody = triggersAllowedBody.includes(eventType);
  } else {
    ({ arn, includeBody } = lambdaConfig);
    if (includeBody && !triggersAllowedBody.includes(eventType)) {
      throw new Error(`"includeBody" not allowed for ${eventType} lambda triggers.`);
    }
  }

  return {
    EventType: eventType,
    LambdaFunctionARN: arn,
    IncludeBody: includeBody,
  };
};

// adds lambda@edge to cache behavior passed
const addLambdaAtEdgeToCacheBehavior = (
  cacheBehavior: any,
  lambdaAtEdgeConfig: LambdaAtEdgeConfig = {}
) => {
  Object.keys(lambdaAtEdgeConfig).forEach((eventType) => {
    if (!validLambdaTriggers.includes(eventType)) {
      throw new Error(
        `"${eventType}" is not a valid lambda trigger. See https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-cloudfront-trigger-events.html for valid event types.`
      );
    }

    cacheBehavior.LambdaFunctionAssociations.Items.push(
      makeCacheItem(eventType, lambdaAtEdgeConfig[eventType])
    );

    cacheBehavior.LambdaFunctionAssociations.Quantity =
      cacheBehavior.LambdaFunctionAssociations.Quantity + 1;
  });
};

export default addLambdaAtEdgeToCacheBehavior;
