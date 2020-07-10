# Next Deploy

Effortless deployment for Next.js apps.

## Contents

- [Getting started](#Getting-started)
- [Configuration](#Configuration)
- [Advanced Configuration](#Advanced-Configuration)
- [AWS Permissions](#AWS-Permissions)
- [Options](#Options)

## Getting started

`yarn add next-deploy`

[Make sure your environment is configured to deploy.](#Configuration)

`yarn next-deploy`

## Configuration

To deploy to AWS you will need to set your credentials in your environment:

```bash
AWS_ACCESS_KEY_ID=******
AWS_SECRET_ACCESS_KEY=******
```

Ensure that your account has [enough permissions to deploy](#AWS-Permissions).

## Advanced Configuration

The deployment configuration is to be provided through `next-deploy.config.js`, which will be automatically created for you the first time you run `yarn next-deploy`.

```javascript
module.exports = {
  debug: false,
  onPreDeploy: () => console.log('⚡ Starting Deployment ⚡'),
  onPostDeploy: () => console.log('✅ Deployment Complete ✅'),
};
```

A more advanced configuration that sets more [configurable options](#Options):

```javascript
const {
  BUCKET_NAME,
  LAMBDA_DESCRIPTION,
  DEFAULT_LAMBDA_NAME,
  API_LAMBDA_NAME,
  SUBDOMAIN,
  DOMAIN,
} = process.env;

module.exports = {
  bucketName: BUCKET_NAME,
  description: LAMBDA_DESCRIPTION,
  name: {
    defaultLambda: DEFAULT_LAMBDA_NAME,
    apiLambda: API_LAMBDA_NAME,
  },
  domain: [SUBDOMAIN, DOMAIN],
  onPreDeploy: () => console.log('⚡ Starting Deployment ⚡'),
  onPostDeploy: () => console.log('✅ Deployment Complete ✅'),
  debug: true,
  build: false,
};
```

## AWS Permissions

You will need the following permissions to be able to deploy:

```
  "acm:DescribeCertificate", // only for custom domains
  "acm:ListCertificates",    // only for custom domains
  "acm:RequestCertificate",  // only for custom domains
  "cloudfront:CreateCloudFrontOriginAccessIdentity",
  "cloudfront:CreateDistribution",
  "cloudfront:CreateInvalidation",
  "cloudfront:GetDistribution",
  "cloudfront:GetDistributionConfig",
  "cloudfront:ListCloudFrontOriginAccessIdentities",
  "cloudfront:ListDistributions",
  "cloudfront:ListDistributionsByLambdaFunction",
  "cloudfront:ListDistributionsByWebACLId",
  "cloudfront:ListFieldLevelEncryptionConfigs",
  "cloudfront:ListFieldLevelEncryptionProfiles",
  "cloudfront:ListInvalidations",
  "cloudfront:ListPublicKeys",
  "cloudfront:ListStreamingDistributions",
  "cloudfront:UpdateDistribution",
  "iam:AttachRolePolicy",
  "iam:CreateRole",
  "iam:CreateServiceLinkedRole",
  "iam:GetRole",
  "iam:PassRole",
  "lambda:CreateFunction",
  "lambda:EnableReplication",
  "lambda:DeleteFunction",            // only for custom domains
  "lambda:GetFunction",
  "lambda:GetFunctionConfiguration",
  "lambda:PublishVersion",
  "lambda:UpdateFunctionCode",
  "lambda:UpdateFunctionConfiguration",
  "route53:ChangeResourceRecordSets", // only for custom domains
  "route53:ListHostedZonesByName",
  "route53:ListResourceRecordSets",   // only for custom domains
  "s3:CreateBucket",
  "s3:GetAccelerateConfiguration",
  "s3:GetObject",                     // only if persisting state to S3 for CI/CD
  "s3:HeadBucket",
  "s3:ListBucket",
  "s3:PutAccelerateConfiguration",
  "s3:PutBucketPolicy",
  "s3:PutObject"
```

## Options

TODO

The next-deploy.config.js config is a combination of BaseDeploymentOptions and AwsComponentInputs types.
