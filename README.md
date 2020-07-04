# Serverless Nextjs Component

A zero configuration Nextjs deployment.

## Contents

- [Motivation](#motivation)
- [Design principles](#design-principles)
- [Features](#features)
- [Getting started](#getting-started)
- [Lambda@Edge configuration](#lambda-at-edge-configuration)
- [Custom domain name](#custom-domain-name)
- [Custom CloudFront configuration](#custom-cloudfront-configuration)
- [Static pages caching](#static-pages-caching)
- [Public directory caching](#public-directory-caching)
- [AWS Permissions](#aws-permissions)
- [Inputs](#inputs)
- [FAQ](#faq)

### Motivation

Ez pz deployments for Next.js

### Design principles

1. Zero configuration by default

There is no configuration needed. You can extend defaults based on your application needs.

2. Feature parity with nextjs

Users of this component should be able to use nextjs development tooling, aka `next dev`. It is the component's job to deploy your application ensuring parity with all of next's features we know and love.

3. Fast deployments / no CloudFormation resource limits.

With a simplified architecture and no use of CloudFormation, there are no limits to how many pages you can have in your application, plus deployment times are very fast! with the exception of CloudFront propagation times of course.

### Getting started

Set your AWS credentials as environment variables:

```bash
AWS_ACCESS_KEY_ID=accesskey
AWS_SECRET_ACCESS_KEY=sshhh
```

And simply deploy:

```bash
$ serverless
```

### Custom domain name

In most cases you wouldn't want to use CloudFront's distribution domain to access your application. Instead, you can specify a custom domain name.

You can use any domain name but you must be using AWS Route53 for your DNS hosting. To migrate DNS records from an existing domain follow the instructions
[here](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/MigratingDNS.html). The requirements to use a custom domain name:

- Route53 must include a _hosted zone_ for your domain (e.g. `mydomain.com`) with a set of nameservers.
- You must update the nameservers listed with your domain name registrar (e.g. namecheap, godaddy, etc.) with those provided for your new _hosted zone_.

The serverless next.js component will automatically generate an SSL certificate and create a new record to point to your CloudFront distribution.

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    domain: 'example.com' # sub-domain defaults to www
```

You can also configure a `subdomain`:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    domain: ['sub', 'example.com'] # [ sub-domain, domain ]
```

### Custom CloudFront configuration

To specify your own CloudFront inputs, just add any [aws-cloudfront inputs](https://github.com/serverless-components/aws-cloudfront#3-configure) under `cloudfront`:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    cloudfront:
      # this is the default cache behaviour of the cloudfront distribution
      # the origin-request edge lambda associated to this cache behaviour does the pages server side rendering
      defaults:
        forward:
          headers:
            [CloudFront-Is-Desktop-Viewer, CloudFront-Is-Mobile-Viewer, CloudFront-Is-Tablet-Viewer]
      # this is the cache behaviour for next.js api pages
      api:
        ttl: 10
      # you can set other cache behaviours like "defaults" above that can handle server side rendering
      # but more specific for a subset of your next.js pages
      /blog/*:
        ttl: 1000
        forward:
          cookies: 'all'
          queryString: false
      /about:
        ttl: 3000
      # you can add custom origins to the cloudfront distribution
      origins:
        - url: /static
          pathPatterns:
            /wp-content/*:
              ttl: 10
        - url: https://old-static.com
          pathPatterns:
            /old-static/*:
              ttl: 10
```

### Static pages caching

Statically rendered pages (i.e. HTML pages that are uploaded to S3) have the following Cache-Control set:

```
cache-control: public, max-age=0, s-maxage=2678400, must-revalidate
```

`s-maxage` allows Cloudfront to cache the pages at the edge locations for 31 days.
`max-age=0` in combination with `must-revalidate` ensure browsers never cache the static pages. This allows Cloudfront to be in full control of caching TTLs. On every deployment an invalidation`/*` is created to ensure users get fresh content.

### Public directory caching

By default, common image formats(`gif|jpe?g|jp2|tiff|png|webp|bmp|svg|ico`) under `/public` or `/static` folders
have a one-year `Cache-Control` policy applied(`public, max-age=31536000, must-revalidate`).
You may customize either the `Cache-Control` header `value` and the regex of which files to `test`, with `publicDirectoryCache`:

```yaml
myNextApplication:
  component: serverless-next.js
  inputs:
    publicDirectoryCache:
      value: public, max-age=604800
      test: /\.(gif|jpe?g|png|txt|xml)$/i
```

`value` must be a valid `Cache-Control` policy and `test` must be a valid `regex` of the types of files you wish to test.
If you don't want browsers to cache assets from the public directory, you can disable this:

```yaml
myNextApplication:
  component: serverless-next.js
  inputs:
    publicDirectoryCache: false
```

### AWS Permissions

By default the Lambda@Edge functions run using AWSLambdaBasicExecutionRole which only allows uploading logs to CloudWatch. If you need permissions beyond this, like for example access to DynamoDB or any other AWS resource you will need your own custom policy arn:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    policy: 'arn:aws:iam::123456789012:policy/MyCustomPolicy'
```

Make sure you add CloudWatch log permissions to your custom policy.

The exhaustive list of AWS actions required for a deployment:

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

### Lambda At Edge Configuration

Both **default** and **api** edge lambdas will be assigned 512mb of memory by default. This value can be altered by assigning a number to the `memory` input

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    memory: 1024
```

Values for **default** and **api** lambdas can be separately defined by assigning `memory` to an object like so:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    memory:
      defaultLambda: 1024
      apiLambda: 2048
```

The same pattern can be followed for specifying the Node.js runtime (nodejs12.x by default):

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    runtime:
      defaultLambda: 'nodejs10.x'
      apiLambda: 'nodejs10.x'
```

Similarly, the timeout by default is 10 seconds. To customise you can:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    timeout:
      defaultLambda: 20
      apiLambda: 15
```

Note the maximum timeout allowed for Lambda@Edge is 30 seconds. See https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-requirements-limits.html

You can also set a custom name for **default** and **api** lambdas - if not the default is set by the [aws-lambda serverless component](https://github.com/serverless-components/aws-lambda) to the resource id:

```yml
# serverless.yml

myNextApplication:
  component: serverless-next.js
  inputs:
    name:
      defaultLambda: fooDefaultLambda
      apiLambda: fooApiLambda
```

### Inputs

| Name          | Type              | Default Value                                                      | Description                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ----------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| domain        | `Array`           | `null`                                                             | For example `['admin', 'portal.com']`                                                                                                                                                                                                                                                                                                                                                            |
| bucketName    | `string`          | `null`                                                             | Custom bucket name where static assets are stored. By default is autogenerated.                                                                                                                                                                                                                                                                                                                  |
| bucketRegion  | `string`          | `null`                                                             | Region where you want to host your s3 bucket. Make sure this is geographically closer to the majority of your end users to reduce latency when CloudFront proxies a request to S3. On first deployment, you may experience 307 temporary redirects if the configured region is not us-east-1. See https://aws.amazon.com/premiumsupport/knowledge-center/s3-http-307-response/ for more details. |
| nextConfigDir | `string`          | `./`                                                               | Directory where your application `next.config.js` file is. This input is useful when the `serverless.yml` is not in the same directory as the next app. <br>**Note:** `nextConfigDir` should be set if `next.config.js` `distDir` is used                                                                                                                                                        |
| nextStaticDir | `string`          | `./`                                                               | If your `static` or `public` directory is not a direct child of `nextConfigDir` this is needed                                                                                                                                                                                                                                                                                                   |
| description   | `string`          | `*lambda-type*@Edge for Next CloudFront distribution`              | The description that will be used for both lambdas. Note that "(API)" will be appended to the API lambda description.                                                                                                                                                                                                                                                                            |
| policy        | `string`          | `arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole` | The arn policy that will be assigned to both lambdas.                                                                                                                                                                                                                                                                                                                                            |
| runtime       | `string\|object`  | `nodejs12.x`                                                       | When assigned a value, both the default and api lambdas will be assigned the runtime defined in the value. When assigned to an object, values for the default and api lambdas can be separately defined                                                                                                                                                                                          |  |
| memory        | `number\|object`  | `512`                                                              | When assigned a number, both the default and api lambdas will be assigned memory of that value. When assigned to an object, values for the default and api lambdas can be separately defined                                                                                                                                                                                                     |  |
| timeout       | `number\|object`  | `10`                                                               | Same as above                                                                                                                                                                                                                                                                                                                                                                                    |
| name          | `string\|object`  | /                                                                  | When assigned a string, both the default and api lambdas will assigned name of that value. When assigned to an object, values for the default and api lambdas can be separately defined                                                                                                                                                                                                          |
| build         | `boolean\|object` | `true`                                                             | When true builds and deploys app, when false assume the app has been built and uses the `.next` `.serverless_nextjs` directories in `nextConfigDir` to deploy. If an object is passed `build` allows for overriding what script gets called and with what arguments.                                                                                                                             |
| build.cmd     | `string`          | `node_modules/.bin/next`                                           | Build command                                                                                                                                                                                                                                                                                                                                                                                    |
| build.args    | `Array\|string`   | `['build']`                                                        | Arguments to pass to the build                                                                                                                                                                                                                                                                                                                                                                   |
| build.cwd     | `string`          | `./`                                                               | Override the current working directory                                                                                                                                                                                                                                                                                                                                                           |
| build.enabled | `boolean`         | `true`                                                             | Same as passing `build:false` but from within the config                                                                                                                                                                                                                                                                                                                                         |

| cloudfront | `object` | `{}` | Inputs to be passed to [aws-cloudfront](https://github.com/serverless-components/aws-cloudfront) |
| domainType | `string` | `"both"` | Can be one of: `"apex"` - apex domain only, don't create a www subdomain. `"www"` - www domain only, don't create an apex subdomain.`"both"` - create both www and apex domains when either one is provided. |
| publicDirectoryCache | `boolean\|object` | `true` | Customize the `public`/`static` folder asset caching policy. Assigning an object with `value` and/or `test` lets you customize the caching policy and the types of files being cached. Assigning false disables caching |
| useServerlessTraceTarget | `boolean` | `false` | Use the experimental-serverless-trace target to build your next app. This is the same build target that Vercel Now uses. See this [RFC](https://github.com/vercel/next.js/pull/8246) for details. |
| verbose | `boolean` | `false` | Print verbose output to the console. |

Custom inputs can be configured like this:

```yaml
myNextApp:
  component: serverless-next.js
  inputs:
    bucketName: my-bucket
```

### FAQ

#### My component doesn't deploy

Make sure your `serverless.yml` uses the `serverless-components` format. [serverless components](https://serverless.com/blog/what-are-serverless-components-how-use/) differ from the original serverless framework, even though they are both accessible via the same CLI.

✅ **Do**

```yml
# serverless.yml
myNextApp:
  component: serverless-next.js

myTable:
  component: serverless/aws-dynamodb
  inputs:
    name: Customers
# other components
```

❌ **Don't**

```yml
# serverless.yml
provider:
  name: aws
  runtime: nodejs10.x
  region: eu-west-1

myNextApp:
  component: serverless-next.js

Resources: ...
```

Note how the correct yaml doesn't declare a `provider`, `Resources`, etc.

For deploying, don't run `serverless deploy`. Simply run `serverless` and that deploys your components declared in the `serverless.yml` file.

For more information about serverless components go [here](https://serverless.com/blog/what-are-serverless-components-how-use/).

#### How do I interact with other AWS Services within my app?

See `examples/dynamodb-crud` for an example Todo application that interacts with DynamoDB.

#### [CI/CD] A new CloudFront distribution is created on every CI build. I wasn't expecting that

You need to commit your application state in source control. That is the files under the `.serverless` directory. Alternatively you could use S3 to store the `.serverless` files, see an example [here](https://gist.github.com/hadynz/b4e190e0ce10e5811cb462920a9c678f)

The serverless team is currently working on remote state storage so this won't be necessary in the future.

#### My lambda is deployed to `us-east-1`. How can I deploy it to another region?

Serverless next.js is _regionless_. By design, `serverless-next.js` applications will be deployed across the globe to every CloudFront edge location. The lambda might look like is only deployed to `us-east-1` but behind the scenes, it is replicated to every other region.

#### I require passing additional information into my build

See the sample below for an advanced `build` setup that includes passing additional arguments and environment variables to the build.

```yml
# serverless.yml
myDatabase:
  component: MY_DATABASE_COMPNENT
myNextApp:
  component: serverless-next.js
  build:
    args: ['build', 'custom/path/to/pages']
    env:
      DATABASE_URL: ${myDatabase.databaseUrl}
```

#### I was expecting for automatic subdomain redirection when using the domainType: www/apex input

The redirection is not currently implemented, but there is a manual workaround outlined [here](https://simonecarletti.com/blog/2016/08/redirect-domain-https-amazon-cloudfront/#configuring-the-amazon-s3-static-site-with-redirect).
In summary, you will have to create a new S3 bucket and set it up with static website hosting to redirect requests to your supported subdomain type (ex. "www.example.com" or "example.com"). To be able to support HTTPS redirects, you'll need to set up a CloudFront distribution with the S3 redirect bucket as the origin. Finally, you'll need to create an "A" record in Route 53 with your newly created CloudFront distribution as the alias target.

## Contributing

Please see the [contributing](./CONTRIBUTING.md) guide.
