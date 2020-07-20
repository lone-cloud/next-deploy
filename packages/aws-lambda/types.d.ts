import { Lambda } from 'aws-sdk';
import { Role } from '@next-deploy/aws-iam-role/types';

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
  role: Role;
  arn?: string;
  zipPath: string;
  hash?: string;
  lambda?: Lambda;
};
