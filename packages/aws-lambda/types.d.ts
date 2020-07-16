import { Lambda } from 'aws-sdk';

export type AwsLambdaInputs = {
  name: string;
  description: string;
  memory: number;
  timeout: number;
  code: string;
  bucket: any;
  shims: never[];
  handler: string;
  runtime: string;
  env: Record<string, string>;
  region: string;
  role: Resource;
  arn?: string;
  zipPath: string;
  hash?: string;
  layer?: Resource;
  lambda?: Lambda;
};

type Resource = {
  policy?: {
    arn: string;
  };
  service?: string[];
  arn?: string;
};
