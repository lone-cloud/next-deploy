import getForwardedValues from './getForwardedValues';
import { PathPatternConfig } from '../../types';

const getCacheBehavior = (
  pathPattern: string,
  pathPatternConfig: PathPatternConfig,
  originId: string
) => {
  const {
    allowedHttpMethods = ['GET', 'HEAD'],
    ttl,
    forward,
    compress = true,
    smoothStreaming = false,
    viewerProtocolPolicy = 'https-only',
    fieldLevelEncryptionId = '',
  } = pathPatternConfig;

  return {
    ForwardedValues: getForwardedValues(forward, {
      cookies: 'all',
      queryString: true,
    }),
    MinTTL: ttl,
    PathPattern: pathPattern,
    TargetOriginId: originId,
    TrustedSigners: {
      Enabled: false,
      Quantity: 0,
    },
    ViewerProtocolPolicy: viewerProtocolPolicy,
    AllowedMethods: {
      Quantity: allowedHttpMethods.length,
      Items: allowedHttpMethods,
      CachedMethods: {
        Items: ['GET', 'HEAD'],
        Quantity: 2,
      },
    },
    Compress: compress,
    SmoothStreaming: smoothStreaming,
    DefaultTTL: ttl,
    MaxTTL: ttl,
    FieldLevelEncryptionId: fieldLevelEncryptionId,
    LambdaFunctionAssociations: {
      Quantity: 0,
      Items: [],
    },
  };
};

export default getCacheBehavior;
