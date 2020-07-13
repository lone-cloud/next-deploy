import { PublishOptions } from 'gh-pages';

export type GithubInputs = BaseDeploymentOptions & {
  publishOptions?: PublishOptions;
};

type DeploymentResult = {
  appUrl?: string;
};
