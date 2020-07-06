import { CloudFront } from 'aws-sdk';

import getOriginConfig from './getOriginConfig';
import getCacheBehavior from './getCacheBehavior';
import addLambdaAtEdgeToCacheBehavior from './addLambdaAtEdgeToCacheBehavior';

import { Origin } from '../../types';

const parseInputOrigins = (origins: string[] | Origin[], options: any) => {
  const distributionOrigins = {
    Quantity: 0,
    Items: [],
  };

  const distributionCacheBehaviors = {
    Quantity: 0,
    Items: [],
  };

  for (const origin of origins) {
    const originConfig = getOriginConfig(origin, options);

    distributionOrigins.Quantity = distributionOrigins.Quantity + 1;
    distributionOrigins.Items.push(originConfig as never);

    if (typeof origin === 'object') {
      // add any cache behaviors
      for (const pathPattern in origin.pathPatterns) {
        const pathPatternConfig = origin.pathPatterns[pathPattern];
        const cacheBehavior = getCacheBehavior(pathPattern, pathPatternConfig, originConfig.Id);

        addLambdaAtEdgeToCacheBehavior(cacheBehavior, pathPatternConfig['lambda@edge']);

        distributionCacheBehaviors.Quantity = distributionCacheBehaviors.Quantity + 1;
        distributionCacheBehaviors.Items.push(cacheBehavior as never);
      }
    }
  }

  return {
    Origins: distributionOrigins as CloudFront.Origins,
    CacheBehaviors: distributionCacheBehaviors,
  };
};

export default parseInputOrigins;
