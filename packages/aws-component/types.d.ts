import { PublicDirectoryCache } from '@next-deploy/aws-s3/types';
import { CloudFrontInputs } from '@next-deploy/aws-cloudfront/types';
import { DomainType } from '@next-deploy/aws-domain/types';

type AwsComponentInputs = BaseDeploymentOptions & {
  nextStaticDir?: string;
  bucketName?: string;
  bucketRegion?: string;
  publicDirectoryCache?: PublicDirectoryCache;
  memory?: number | { [key in LambdaType]: number };
  timeout?: number | { [key in LambdaType]: number };
  name?: string | { [key in LambdaType]: string };
  runtime?: string | { [key in LambdaType]: string };
  description?: string | { [key in LambdaType]: string };
  policy?: string;
  domainType?: DomainType;
  cloudfront?: CloudFrontInputs;
};

type LambdaType = 'requestLambda' | 'responseLambda';

type LambdaInput = {
  description: string;
  handler: string;
  code: string;
  role: Record<string, unknown>;
  memory: number;
  timeout: number;
  runtime: string;
  name?: string;
};

type DeploymentResult = {
  appUrl: string;
  bucketName: string;
};
