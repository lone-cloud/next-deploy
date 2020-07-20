import { CloudFront, S3 } from 'aws-sdk';

import parseInputOrigins from './parseInputOrigins';
import getDefaultCacheBehavior from './getDefaultCacheBehavior';
import createOriginAccessIdentity from './createOriginAccessIdentity';
import grantCloudFrontBucketAccess from './grantCloudFrontBucketAccess';
import { CloudFrontInputs, Origin } from '../../types';

export { default as createInvalidation } from './createInvalidation';

const servePrivateContentEnabled = (inputs: CloudFrontInputs) =>
  inputs?.origins?.some((origin: string | Origin) => origin && (origin as Origin).private === true);
const unique = (value: string, index: number, self: string[]) => self.indexOf(value) === index;
const updateBucketsPolicies = async (
  s3: S3,
  origins: CloudFront.Origins,
  s3CanonicalUserId: string
) => {
  // update bucket policies with cloudfront access
  const bucketNames = origins.Items.filter((origin) => origin.S3OriginConfig)
    .map(
      (origin) =>
        // remove path from the bucket name if origin had pathname
        origin.Id.split('/')[0]
    )
    .filter(unique);

  return Promise.all(
    bucketNames.map((bucketName: string) =>
      grantCloudFrontBucketAccess(s3, bucketName, s3CanonicalUserId)
    )
  );
};

export const createCloudFrontDistribution = async (
  cf: CloudFront,
  s3: S3,
  inputs: CloudFrontInputs
): Promise<{
  id?: string;
  arn?: string;
  url?: string;
}> => {
  let originAccessIdentityId;
  let s3CanonicalUserId;

  if (servePrivateContentEnabled(inputs)) {
    ({ originAccessIdentityId, s3CanonicalUserId } = await createOriginAccessIdentity(cf));
  }

  const { Origins, CacheBehaviors } = parseInputOrigins(inputs.origins, {
    originAccessIdentityId,
  });

  if (s3CanonicalUserId) {
    await updateBucketsPolicies(s3, Origins, s3CanonicalUserId);
  }

  const createDistributionRequest: CloudFront.Types.CreateDistributionRequest = {
    DistributionConfig: {
      CallerReference: String(Date.now()),
      Comment: inputs.comment as string,
      Aliases: {
        Quantity: 0,
        Items: [],
      },
      Origins,
      PriceClass: inputs.priceClass,
      Enabled: inputs.enabled as boolean,
      HttpVersion: 'http2',
      DefaultCacheBehavior: getDefaultCacheBehavior(Origins.Items[0].Id, inputs.defaults),
    },
  };

  if (CacheBehaviors) {
    createDistributionRequest.DistributionConfig.CacheBehaviors = CacheBehaviors;
  }

  const res = await cf.createDistribution(createDistributionRequest).promise();

  return {
    id: res?.Distribution?.Id,
    arn: res?.Distribution?.ARN,
    url: `https://${res?.Distribution?.DomainName}`,
  };
};

export const updateCloudFrontDistribution = async (
  cf: CloudFront,
  s3: S3,
  distributionId: string,
  inputs: CloudFrontInputs
): Promise<{
  id?: string;
  arn?: string;
  url?: string;
}> => {
  const distributionConfigResponse = await cf
    .getDistributionConfig({ Id: distributionId })
    .promise();

  if (!distributionConfigResponse.DistributionConfig) {
    throw new Error('Could not get a distribution config');
  }

  let s3CanonicalUserId;
  let originAccessIdentityId;

  if (servePrivateContentEnabled(inputs)) {
    // presumably it's ok to call create origin access identity again
    // aws api returns cached copy of what was previously created
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html#createCloudFrontOriginAccessIdentity-property
    ({ originAccessIdentityId, s3CanonicalUserId } = await createOriginAccessIdentity(cf));
  }

  const { Origins, CacheBehaviors } = parseInputOrigins(inputs.origins, {
    originAccessIdentityId,
  });

  if (s3CanonicalUserId) {
    await updateBucketsPolicies(s3, Origins, s3CanonicalUserId);
  }

  const updateDistributionRequest: CloudFront.Types.UpdateDistributionRequest = {
    Id: distributionId,
    IfMatch: distributionConfigResponse.ETag,
    DistributionConfig: {
      ...distributionConfigResponse.DistributionConfig,
      PriceClass: inputs.priceClass,
      Enabled: inputs.enabled as boolean,
      Comment: inputs.comment as string,
      DefaultCacheBehavior: getDefaultCacheBehavior(Origins.Items[0].Id, inputs.defaults),
      Origins,
    },
  };

  const origins = updateDistributionRequest.DistributionConfig.Origins;
  const existingOriginIds = origins.Items.map((origin) => origin.Id);

  Origins.Items.forEach((inputOrigin) => {
    const originIndex = existingOriginIds.indexOf(inputOrigin.Id);

    if (originIndex > -1) {
      // replace origin with new input configuration
      origins.Items.splice(originIndex, 1, inputOrigin);
    } else {
      origins.Items.push(inputOrigin);
      origins.Quantity += 1;
    }
  });

  if (CacheBehaviors) {
    updateDistributionRequest.DistributionConfig.CacheBehaviors = CacheBehaviors;
  }

  const res = await cf.updateDistribution(updateDistributionRequest).promise();

  return {
    id: res?.Distribution?.Id,
    arn: res?.Distribution?.ARN,
    url: `https://${res?.Distribution?.DomainName}`,
  };
};

const disableCloudFrontDistribution = async (
  cf: CloudFront,
  distributionId: string,
  debug: (message: string) => void
) => {
  const distributionConfigResponse = await cf
    .getDistributionConfig({ Id: distributionId })
    .promise();

  if (!distributionConfigResponse.DistributionConfig) {
    throw new Error('Could not get a distribution config');
  }

  const updateDistributionRequest: CloudFront.Types.UpdateDistributionRequest = {
    Id: distributionId,
    IfMatch: distributionConfigResponse.ETag,
    DistributionConfig: {
      ...distributionConfigResponse.DistributionConfig,
      Enabled: false,
    },
  };

  const res = await cf.updateDistribution(updateDistributionRequest).promise();

  debug('Waiting for the CloudFront distribution changes to be deployed.');
  await cf.waitFor('distributionDeployed', { Id: distributionId }).promise();

  return res;
};

export const deleteCloudFrontDistribution = async (
  cf: CloudFront,
  distributionId: string,
  debug: (message: string) => void
): Promise<void> => {
  try {
    const res = await cf.getDistributionConfig({ Id: distributionId }).promise();

    const params = { Id: distributionId, IfMatch: res.ETag };
    await cf.deleteDistribution(params).promise();
  } catch (e) {
    if (e.code === 'DistributionNotDisabled') {
      await disableCloudFrontDistribution(cf, distributionId, debug);
    } else {
      throw e;
    }
  }
};
