# Next Deploy

Effortless deployment for Next.js apps 🚀

## Table of Contents

- [Getting Started](#Getting-Started)
- [Background](#Background)
- [CLI](#CLI)
- [Environment](#Environment)
  - [GitHub](#GitHub)
  - [AWS](#AWS)
- [Configuration Options](#Configuration-Options)
  - [Base Options](#Base-Options)
  - [GitHub Options](#GitHub-Options)
  - [AWS Options](#AWS-Options)
- [Advanced Configuration](#Advanced-Configuration)
- [CI/CD](#CICD)

## Getting Started

Make sure your environment is [configured to deploy](#Configuration).

Run your deployment with a one-liner:

- `npx next-deploy`

Optionally you can also add and run `next deploy` from your Next.js app:

- `yarn add --dev next-deploy`
- `yarn next-deploy`

## Background

Next Deploy was created to deploy web applications built using the wonderful [Next.js](https://nextjs.org/) framework. It allows teams to easily integrate with our supported engines (AWS, GitHub Pages) and keep the entirety of their code in source control; from frontend, to backend, to the deployment logic.

Next Deploy started as a fork of [serverless-next.js](https://github.com/serverless-nextjs/serverless-next.js) which itself is an orchestrator of various orphaned [serverless-components](https://github.com/serverless-components/). Next Deploy was created out of a need for a better, strongly typed codebase and an ability to provide more advanced functionality without the [influence of corporate backers](https://opencollective.com/goserverless#section-contributions).

## CLI

Next Deploy comes with a `next-deploy [argument]` CLI that you can run with `npx next-deploy` or `yarn next-deploy`.

There are currently 5 supported arguments:

- **Default** (default): Runs **Build** followed by **Deploy**.

- **Init**: Creates the base next-deploy.config.js configuration for your project.

- **Build**: Build the application for deployment.

- **Deploy**: Deploy the built application.

- **Remove**: Remove the deployed resources. Note that some resources (such as lambda@edge lambdas need to be cleaned up manually due to a timing constraint).

## Environment

### GitHub

No specific environment configuration is necessary. By default, your app will be built and exported to the `gh-pages` branch.

### AWS

To deploy to AWS you will need to set your credentials in your environment:

```bash
AWS_ACCESS_KEY_ID=******
AWS_SECRET_ACCESS_KEY=******
```

If your account is restricted, ensure that you have enough permissions to deploy.
You will need the following permissions:

<details>
  <summary>Click to view</summary>

```
  'acm:DescribeCertificate', // only for custom domains
  'acm:ListCertificates',    // only for custom domains
  'acm:RequestCertificate',  // only for custom domains
  'cloudfront:CreateCloudFrontOriginAccessIdentity',
  'cloudfront:CreateDistribution',
  'cloudfront:CreateInvalidation',
  'cloudfront:GetDistribution',
  'cloudfront:GetDistributionConfig',
  'cloudfront:ListCloudFrontOriginAccessIdentities',
  'cloudfront:ListDistributions',
  'cloudfront:ListDistributionsByLambdaFunction',
  'cloudfront:ListDistributionsByWebACLId',
  'cloudfront:ListFieldLevelEncryptionConfigs',
  'cloudfront:ListFieldLevelEncryptionProfiles',
  'cloudfront:ListInvalidations',
  'cloudfront:ListPublicKeys',
  'cloudfront:ListStreamingDistributions',
  'cloudfront:UpdateDistribution',
  'iam:AttachRolePolicy',
  'iam:CreateRole',
  'iam:CreateServiceLinkedRole',
  'iam:GetRole',
  'iam:PassRole',
  'lambda:CreateFunction',
  'lambda:EnableReplication',
  'lambda:DeleteFunction', // only for custom domains
  'lambda:GetFunction',
  'lambda:GetFunctionConfiguration',
  'lambda:PublishVersion',
  'lambda:UpdateFunctionCode',
  'lambda:UpdateFunctionConfiguration',
  'route53:ChangeResourceRecordSets', // only for custom domains
  'route53:ListHostedZonesByName',
  'route53:ListResourceRecordSets', // only for custom domains
  's3:CreateBucket',
  's3:GetAccelerateConfiguration',
  's3:GetObject', // only if persisting state to S3 for CI/CD
  's3:HeadBucket',
  's3:ListBucket',
  's3:PutAccelerateConfiguration',
  's3:PutBucketPolicy',
  's3:PutObject';
```

</details>

## Configuration Options

The next-deploy config varies by the provider (engine) that you're deploying to. All configuration options are optional and come with sensible defaults.
The deployment configuration is to be provided through `next-deploy.config.js`, which will be automatically created for you the first time you run `next-deploy` or `next-deploy init`.

### Base Options

All engines support the basic options:

| Name          | Type                            | Default | Description                                                                                              |
| ------------- | ------------------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| engine        | `"aws"\|"github"`               | `aws`   | The platform to deploy to.                                                                               |
| debug         | `boolean`                       | `false` | Print helpful messages to                                                                                |
| onPreDeploy   | `() => Promise<void>`           | `null`  | A callback that gets called before the deployment.                                                       |
| onPostDeploy  | `() => Promise<void>`           | `null`  | A callback that gets called after the deployment successfully finishes.                                  |
| onShutdown    | `() => Promise<void>`           | `null`  | A callback that gets called after the deployment is shutdown by a INT/QUIT/TERM signal like from ctrl+c. |
| buildOptions  | [`BuildOptions`](#BuildOptions) | `{}`    | Build related options.                                                                                   |
| nextConfigDir | `string`                        | `./`    | The directory holding the `next.config.js`.                                                              |
| domain        | `string\|string[]`              | `null`  | The domain to deploy to .                                                                                |

#### BuildOptions

| Name | Type       | Default                  | Description                                          |
| ---- | ---------- | ------------------------ | ---------------------------------------------------- |
| cmd  | `string`   | `node_modules/.bin/next` | The build command.                                   |
| args | `string[]` | `['build']`              | A list of arguments to provide to the build command. |
| cwd  | `string`   | `./`                     | The current working directory.                       |

### Github Options

| Name           | Type                                                            | Default                                               | Description                                                                              |
| -------------- | --------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| publishOptions | [`PublishOptions`](https://github.com/tschaub/gh-pages#options) | `{message: "Next Deployment Update", dotfiles: true}` | The [git-hub page options](https://github.com/tschaub/gh-pages#options) to publish with. |

### AWS Options

| Name                 | Type                                                       | Default                                                                               | Description                                                                                                                                                                                                         |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bucketName           | `string`                                                   | `*auto generated*`                                                                    | Custom bucket name where static assets are stored.                                                                                                                                                                  |
| bucketRegion         | `string`                                                   | `us-east-1`                                                                           | Region where you want to host your S3 bucket.                                                                                                                                                                       |
| publicDirectoryCache | `boolean\|`[`PublicDirectoryCache`](#PublicDirectoryCache) | `true`                                                                                | Customize the public/static directory asset caching policy. Assigning an object lets you customize the caching policy and the types of files being cached. Assigning false disables caching.                        |
| memory               | `number`                                                   | `512`                                                                                 | The amount of memory that a lambda has access to. Increasing the lambda's memory also increases its CPU allocation. The value must be a multiple of 64 MB.                                                          |
| timeout              | `number`                                                   | `10`                                                                                  | The amount of time that the lambda allows a function to run before stopping it. The maximum allowed value is 900 seconds.                                                                                           |
| name                 | `string`                                                   | `*auto generated*`                                                                    | The name of the lambda function.                                                                                                                                                                                    |
| runtime              | `string`                                                   | `nodejs12.x`                                                                          | The identifier of the lambda's runtime.                                                                                                                                                                             |
| description          | `string`                                                   | <details>`"*lambda type* handler for the Next CloudFront distribution."`</details>    | A description of the lambda.                                                                                                                                                                                        |
| policy               | `string`                                                   | <details>`arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`</details> | The arn policy of the lambda.                                                                                                                                                                                       |
| domainType           | `"www"\|"apex"\|"both"`                                    | `both`                                                                                | Can be one of: "**apex**" - apex domain only, don't create a www subdomain. "**www**" - www domain only, don't create an apex subdomain. "**both**" - create both www and apex domains when either one is provided. |
| cloudfront           | [`CloudFront`](#CloudFront)                                | `{}`                                                                                  | Additional cloudfront options.                                                                                                                                                                                      |

#### PublicDirectoryCache

| Name  | Type     | Default                                           | Description                              |
| ----- | -------- | ------------------------------------------------- | ---------------------------------------- |
| test  | `string` | `/\.(gif|jpe?g|jp2|tiff|png|webp|bmp|svg|ico)$/i` | The test to apply the caching behaviour. |
| value | `string` | `public, max-age=31536000, must-revalidate`       | The caching behavior.                    |

#### CloudFront

| Name                   | Type                                        | Default             | Description                                                                                                                                                 |
| ---------------------- | ------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ttl                    | `number`                                    | `0`                 | The amount of time that you want objects to stay in CloudFront's cache before it forwards another request to determine whether the object has been updated. |
| smoothStreaming        | `boolean`                                   | `false`             | Indicates whether you want to distribute media files in the Microsoft Smooth Streaming format.                                                              |
| viewerProtocolPolicy   | `string`                                    | `redirect-to-https` | The policy for viewers to access the content.                                                                                                               |
| fieldLevelEncryptionId | `string`                                    | `""`                | The value of the ID for the field-level encryption configuration that you want to use.                                                                      |
| forward                | [`Forward`](#Forward)                       | `{}`                | Determines the forwarding configuration                                                                                                                     |
| viewerCertificate      | [`ViewerCertificate`](#ViewerCertificate)   | `{}`                | Determines the SSL/TLS configuration for communicating with viewers.                                                                                        |
| cookies                | `string\|string[]`                          | `all`               | Indicates which cookies should be forwarded.                                                                                                                |
| queryString            | `boolean`                                   | `true`              | Indicates whether the query string should be forwarded.                                                                                                     |
| lambda@edge            | [`LambdaAtEdgeConfig`](#LambdaAtEdgeConfig) | `TODO`              | TODO                                                                                                                                                        |

#### Forward

| Name                 | Type       | Default | Description |
| -------------------- | ---------- | ------- | ----------- |
| cookies              | `string[]` | `TODO`  | TODO        |
| queryString          | `string`   | `TODO`  | TODO        |
| headers              | `string[]` | `TODO`  | TODO        |
| queryStringCacheKeys | `string[]` | `TODO`  | TODO        |

#### ViewerCertificate

| Name                   | Type     | Default        | Description                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | -------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ACMCertificateArn      | `string` | `null`         | If the SSL/TLS certificate is stored in ACM, provide the ARN of the ACM certificate. CloudFront only supports ACM certificates in the us-east-1.                                                                                                                                                                                   |
| SSLSupportMethod       | `string` | `sni-only`     | Specifies which viewers the distribution accepts HTTPS connections from. **sni-only** – The distribution accepts HTTPS connections only from viewers that support server SNI (all modern browsers). **vip** – The distribution accepts HTTPS connections from **all** (not recommended and results in additional monthly charges). |
| minimumProtocolVersion | `string` | `TLSv1.2_2018` | The security policy that you want to use for HTTPS connections with viewers.                                                                                                                                                                                                                                                       |

#### LambdaAtEdgeConfig

| Name        | Type      | Default | Description |
| ----------- | --------- | ------- | ----------- |
| arn         | `string`  | `null`  | TODO        |
| includeBody | `boolean` | `TODO`  | TODO        |

### Advanced Configuration

Environment variables may be substituted from `process.env` to allow for more flexibility.

### CI/CD

TODO
