import { CloudFront } from 'aws-sdk';

const createOriginAccessIdentity = async (cf: CloudFront) => {
  const { CloudFrontOriginAccessIdentity } = await cf
    .createCloudFrontOriginAccessIdentity({
      CloudFrontOriginAccessIdentityConfig: {
        CallerReference: 'next-deploy-managed-cloudfront-access-identity',
        Comment: 'CloudFront Origin Access Identity created to allow serving private S3 content',
      },
    })
    .promise();

  return {
    originAccessIdentityId: CloudFrontOriginAccessIdentity?.Id,
    s3CanonicalUserId: CloudFrontOriginAccessIdentity?.S3CanonicalUserId,
  };
};

export default createOriginAccessIdentity;
