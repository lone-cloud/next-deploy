# Next Deploy

Effortless deployment for Next.js apps. 🚀

## Table of Contents

- [Getting started](#Getting-started)
- [Background](#Background)
- [Configuration](#Configuration)
- [Advanced Configuration](#Advanced-Configuration)
- [Options](#Configuration-Options)

## Getting started

[Make sure your environment is configured to deploy.](#Configuration)

The one-liner: `npx next-deploy`

You can also install locally:
`yarn add --dev next-deploy`
`yarn next-deploy`

## Background

Next Deploy started as a fork of [serverless-next.js](#https://github.com/serverless-nextjs/serverless-next.js) which itself is an orchestrator of various [serverless-components](#https://github.com/serverless-components/).

## Configuration

### AWS

To deploy to AWS you will need to set your credentials in your environment:

```bash
AWS_ACCESS_KEY_ID=******
AWS_SECRET_ACCESS_KEY=******
```

If your account is restricted, [ensure that you have enough permissions to deploy](docs/aws-permissions.md).

### GitHub

TODO

## Advanced Configuration

The deployment configuration is to be provided through `next-deploy.config.js`, which will be automatically created for you the first time you run `next-deploy`.

```javascript
module.exports = {
  debug: false,
  onPreDeploy: () => console.log('⚡ Starting Deployment'),
};
```

A more advanced configuration that sets more [configurable options](#ConfigurationOptions):

```javascript
module.exports = {
  engine: 'aws',
  onPreDeploy: () => console.log('⚡ Starting Deployment ⚡'),
  onShutdown: () => console.log('⛔ Interrupted ⛔'),
  onPostDeploy: () => console.log('🌟 Deployment Complete 🌟'),
  debug: true,

  bucketName: 'bucket-name',
  description: 'lambda-description',
  name: 'lambda-name',
  domain: ['foobar', 'example.com'],
};
```

Environment variables may be substituted from `process.env` to allow for more flexibility that one would need for CI/CD.

## Configuration Options

The next-deploy config varies by the provider (engine) that you're deploying to. All configuration options are optional and come with sensible defaults.

All engines support the basic options:

| Name         | Type                  | Default     | Description                                                                                              |
| :----------- | :-------------------- | :---------- | :------------------------------------------------------------------------------------------------------- |
| engine       | `"aws" \| "github"`   | `"aws"`     | The platform to deploy to.                                                                               |
| debug        | `boolean`             | `false`     | Print helpful messages to                                                                                |
| onPreDeploy  | `() => Promise<void>` | `undefined` | A callback that gets called before the deployment.                                                       |
| onPostDeploy | `() => Promise<void>` | `undefined` | A callback that gets called after the deployment successfully finishes.                                  |
| onShutdown   | `() => Promise<void>` | `undefined` | A callback that gets called after the deployment is shutdown by a INT/QUIT/TERM signal like from ctrl+c. |

TODO
