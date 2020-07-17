import { PublicDirectoryCache, Stage } from '@next-deploy/aws-s3/types';
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
  stage?: boolean | Stage;
};

type LambdaType = 'requestLambda' | 'responseLambda';

type DeploymentResult = {
  appUrl: string;
  bucketName: string;
};
