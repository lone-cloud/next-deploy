# Next Deploy

Effortless deployment for Next.js apps. 🚀

## Table of Contents

- [Getting started](#Getting-started)
- [Background](#Background)
- [Configuration](#Configuration)
- [Advanced Configuration](#Advanced-Configuration)
- [Options](#Configuration-Options)

## Getting started

`yarn add --dev next-deploy`

[Make sure your environment is configured to deploy.](#Configuration)

`yarn next-deploy`

## Background

next-deploy started as a fork of [serverless-next.js](#https://github.com/serverless-nextjs/serverless-next.js) which itself is an orchestrator of various [serverless-components](#https://github.com/serverless-components/).

## Configuration

To deploy to AWS you will need to set your credentials in your environment:

```bash
AWS_ACCESS_KEY_ID=******
AWS_SECRET_ACCESS_KEY=******
```

If your account is restricted, [ensure that you enough permissions to deploy](docs/aws-permissions.md).

## Advanced Configuration

The deployment configuration is to be provided through `next-deploy.config.js`, which will be automatically created for you the first time you run `yarn next-deploy`.

```javascript
module.exports = {
  debug: false,
  onPreDeploy: () => console.log('⚡ Starting Deployment'),
};
```

A more advanced configuration that sets more [configurable options](#Options):

```javascript
module.exports = {
  bucketName: process.env.BUCKET_NAME,
  description: process.env.LAMBDA_DESCRIPTION,
  name: {
    defaultLambda: process.env.DEFAULT_LAMBDA_NAME,
    apiLambda: process.env.API_LAMBDA_NAME,
  },
  domain: [process.env.SUBDOMAIN, process.env.DOMAIN],
  onPreDeploy: () => console.log('⚡ Starting Deployment ⚡'),
  onPostDeploy: () => console.log('✅ Deployment Complete ✅'),
  debug: true,
  build: true,
};
```

## Configuration Options

The next-deploy config varies by the provider (engine) that you're deploying to. All configuration options are optional and come with sensible defaults.

All engines support the basic options:

| Name         | Type                  | Default     | Description                                                                |
| :----------- | :-------------------- | :---------- | :------------------------------------------------------------------------- |
| engine       | `"aws"`               | `"aws"`     | The deployment host.                                                       |
| debug        | `boolean`             | `false`     | Print helpful messages to                                                  |
| onPreDeploy  | `() => Promise<void>` | `undefined` | A callback to that gets called before the deployment.                      |
| onPostDeploy | `() => Promise<void>` | `undefined` | A callback to that gets called after the deployment successfully finishes. |

TODO
