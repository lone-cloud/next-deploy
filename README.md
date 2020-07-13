# Next Deploy

Effortless deployment for Next.js apps 🚀

## Table of Contents

- [Getting Started](#Getting-Started)
- [Background](#Background)
- [Configuration](#Configuration)
  - [AWS](#AWS)
  - [GitHub](#GitHub)
  - [Advanced Configuration](#Advanced-Configuration)
- [CLI](#CLI)
- [Configuration Options](#Configuration-Options)
  - [Base Options](#Base-Options)
  - [GitHub Options](#GitHub-Options)
  - [AWS Options](#AWS-Options)
- [CI/CD](#CI/CD)

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

## Configuration

### AWS

To deploy to AWS you will need to set your credentials in your environment:

```bash
AWS_ACCESS_KEY_ID=******
AWS_SECRET_ACCESS_KEY=******
```

If your account is restricted, [ensure that you have enough permissions to deploy](docs/aws-permissions.md).

### GitHub

No specific configuration is necessary. By default, your app will be built and exported to the `gh-pages` branch.

### Advanced Configuration

The deployment configuration is to be provided through `next-deploy.config.js`, which will be automatically created for you the first time you run `next-deploy`.

```javascript
module.exports = {
  engine: 'aws',
  debug: true,
};
```

A more advanced configuration that sets more [configurable options](#Configuration-Options):

```javascript
module.exports = {
  engine: 'aws',
  onShutdown: () => console.log('⛔ Interrupted ⛔'),
  onPostDeploy: () => console.log('🌟 Deployment Complete 🌟'),
  debug: true,

  bucketName: 'my-bucket-name',
  description: 'My new lambda description.',
  name: 'lambda-name',
  domain: ['foobar', 'example.com'],
};
```

Environment variables may be substituted from `process.env` to allow for more flexibility that one would need for CI/CD.

## CLI

Next Deploy comes with a `next-deploy [argument]` CLI that you can run like `npx next-deploy` or `yarn next-deploy`.

There are currently 5 supported arguments:

**Default** (default): Runs **Build** followed by **Deploy**.

**Init**: Creates the base next-deploy.config.js configuration for your project.

**Build**: Build the application for deployment.

**Deploy**: Deploy the built application.

**Remove**: Remove, or at least attempt to remove, the deployed resources. Note that some resources (such as lambda@edge lambdas need to be cleaned up manually due to a timing constraint).

## Configuration Options

The next-deploy config varies by the provider (engine) that you're deploying to. All configuration options are optional and come with sensible defaults.

### Base Options

All engines support the basic options:

| Name          | Type                    | Default     | Description                                                                                              |
| :------------ | :---------------------- | :---------- | :------------------------------------------------------------------------------------------------------- |
| engine        | `"aws"\|"github"`       | `"aws"`     | The platform to deploy to.                                                                               |
| debug         | `boolean`               | `false`     | Print helpful messages to                                                                                |
| onPreDeploy   | `() => Promise<void>`   | `undefined` | A callback that gets called before the deployment.                                                       |
| onPostDeploy  | `() => Promise<void>`   | `undefined` | A callback that gets called after the deployment successfully finishes.                                  |
| onShutdown    | `() => Promise<void>`   | `undefined` | A callback that gets called after the deployment is shutdown by a INT/QUIT/TERM signal like from ctrl+c. |
| build         | `BuildOptions\|boolean` | `true`      | Whether a new build should be run run or not.                                                            |
| nextConfigDir | `string`                | `./`        | The directory holding the `next.config.js`.                                                              |
| domain        | `string\|string[]`      | `null`      | The domain to deploy to .                                                                                |

### Github Options

| Name           | Type                                                            | Default                            | Description                                                                              |
| :------------- | :-------------------------------------------------------------- | :--------------------------------- | :--------------------------------------------------------------------------------------- |
| publishOptions | [`PublishOptions`](https://github.com/tschaub/gh-pages#options) | `{message: '...', dotfiles: true}` | The [git-hub page options](https://github.com/tschaub/gh-pages#options) to publish with. |

### AWS Options

TODO

## CI/CD

TODO
