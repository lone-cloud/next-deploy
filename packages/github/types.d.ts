import { PublishOptions } from 'gh-pages';

export type GithubInputs = BaseDeploymentOptions & {
  publish?: PublishOptions;
};

type DeploymentResult = {
  appUrl?: string;
};
