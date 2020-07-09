import { PublicDirectoryCache } from '@next-deploy/aws-s3/types';
import { CloudFrontInputs } from '@next-deploy/aws-cloudfront/types';

type AwsComponentInputs = {
  build?: BuildOptions | boolean;
  nextConfigDir?: string;
  nextStaticDir?: string;
  bucketName?: string;
  bucketRegion?: string;
  publicDirectoryCache?: PublicDirectoryCache;
  memory?: number | { defaultLambda?: number; apiLambda?: number };
  timeout?: number | { defaultLambda?: number; apiLambda?: number };
  name?: string | { defaultLambda?: string; apiLambda?: string };
  runtime?: string | { defaultLambda?: string; apiLambda?: string };
  description?: string;
  policy?: string;
  domain?: string | string[];
  domainType?: DomainType;
  cloudfront?: CloudFrontInputs;
};

type DomainType = 'www' | 'apex' | 'both';

type BuildOptions = {
  cwd?: string;
  enabled?: boolean;
  cmd: string;
  args: string[];
};

type LambdaType = 'defaultLambda' | 'apiLambda';

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
