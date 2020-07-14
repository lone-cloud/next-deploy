import { CloudFront } from 'aws-sdk';

import addLambdaAtEdgeToCacheBehavior from './addLambdaAtEdgeToCacheBehavior';
import getForwardedValues from './getForwardedValues';
import { PathPatternConfig } from '../../types';

const getDefaultCacheBehavior = (originId: string, defaults: PathPatternConfig = {}) => {
  const {
    allowedHttpMethods = ['HEAD', 'GET'],
    forward = {},
    ttl = 86400,
    compress = false,
    smoothStreaming = false,
    viewerProtocolPolicy = 'redirect-to-https',
    fieldLevelEncryptionId = '',
  } = defaults;

  const defaultCacheBehavior = {
    TargetOriginId: originId,
    ForwardedValues: getForwardedValues(forward || {}),
    TrustedSigners: {
      Enabled: false,
      Quantity: 0,
      Items: [],
    },
    ViewerProtocolPolicy: viewerProtocolPolicy,
    MinTTL: 0,
    AllowedMethods: {
      Quantity: allowedHttpMethods.length,
      Items: allowedHttpMethods,
      CachedMethods: {
        Quantity: 2,
        Items: ['HEAD', 'GET'],
      },
    },
    SmoothStreaming: smoothStreaming,
    DefaultTTL: ttl,
    MaxTTL: 31536000,
    Compress: compress,
    LambdaFunctionAssociations: {
      Quantity: 0,
      Items: [],
    },
    FieldLevelEncryptionId: fieldLevelEncryptionId,
  };

  addLambdaAtEdgeToCacheBehavior(defaultCacheBehavior, defaults['lambda@edge']);

  return (defaultCacheBehavior as any) as CloudFront.Types.CacheBehavior;
};

export default getDefaultCacheBehavior;
