import { tmpdir } from 'os';
import path from 'path';
import archiver, { Format } from 'archiver';
import globby from 'globby';
import { contains, isNil, last, split, equals, not, pick } from 'ramda';
import { readFile, createReadStream, createWriteStream } from 'fs-extra';
import { utils } from '@serverless/core';
import { Lambda } from 'aws-sdk';

import { AwsLambdaInputs } from '../types';

const VALID_FORMATS = ['zip', 'tar'];
const isValidFormat = (format: Format) => contains(format, VALID_FORMATS);

const packDir = async (
  inputDirPath: string,
  outputFilePath: string,
  include: string[] = [],
  exclude: string[] = [],
  prefix?: string
) => {
  const format = last(split('.', outputFilePath)) as Format;

  if (!isValidFormat(format)) {
    throw new Error('Please provide a valid format. Either a "zip" or a "tar".');
  }

  const patterns = ['**/*'];

  if (!isNil(exclude)) {
    exclude.forEach((excludedItem) => patterns.push(`!${excludedItem}`));
  }

  const files = (await globby(patterns, { cwd: inputDirPath, dot: true }))
    .sort() // we must sort to ensure correct hash
    .map((file) => ({
      input: path.join(inputDirPath, file),
      output: prefix ? path.join(prefix, file) : file,
    }));

  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputFilePath);
    const archive = archiver(format, {
      zlib: { level: 9 },
    });

    output.on('open', () => {
      archive.pipe(output);

      // we must set the date to ensure correct hash
      files.forEach((file) =>
        archive.append(createReadStream(file.input), {
          name: file.output,
          date: new Date(0),
        })
      );

      if (!isNil(include)) {
        include.forEach((file) => {
          const stream = createReadStream(file);
          archive.append(stream, {
            name: path.basename(file),
            date: new Date(0),
          });
        });
      }

      archive.finalize();
    });

    archive.on('error', (err) => reject(err));
    output.on('close', () => resolve(outputFilePath));
  });
};

export const createLambda = async ({
  lambda,
  name,
  handler,
  memory,
  timeout,
  runtime,
  env,
  description,
  zipPath,
  bucket,
  role,
  layer,
}: AwsLambdaInputs): Promise<{ arn?: string; hash?: string }> => {
  const params: Lambda.Types.CreateFunctionRequest = {
    FunctionName: name,
    Code: {},
    Description: description,
    Handler: handler,
    MemorySize: memory,
    Publish: true,
    Role: role.arn,
    Runtime: runtime,
    Timeout: timeout,
    Environment: {
      Variables: env,
    },
  };

  if (layer && layer.arn) {
    params.Layers = [layer.arn];
  }

  if (bucket) {
    params.Code.S3Bucket = bucket;
    params.Code.S3Key = path.basename(zipPath);
  } else {
    params.Code.ZipFile = await readFile(zipPath);
  }

  const res = await (lambda as Lambda).createFunction(params).promise();

  return { arn: res.FunctionArn, hash: res.CodeSha256 };
};

export const updateLambdaConfig = async ({
  lambda,
  name,
  handler,
  memory,
  timeout,
  runtime,
  env,
  description,
  role,
  layer,
}: AwsLambdaInputs): Promise<{ arn?: string; hash?: string }> => {
  const functionConfigParams: Lambda.Types.UpdateFunctionConfigurationRequest = {
    FunctionName: name,
    Description: description,
    Handler: handler,
    MemorySize: memory,
    Role: role.arn,
    Runtime: runtime,
    Timeout: timeout,
    Environment: {
      Variables: env,
    },
  };

  if (layer && layer.arn) {
    functionConfigParams.Layers = [layer.arn];
  }

  const res = await (lambda as Lambda).updateFunctionConfiguration(functionConfigParams).promise();

  return { arn: res.FunctionArn, hash: res.CodeSha256 };
};

export const updateLambdaCode = async ({
  lambda,
  name,
  zipPath,
  bucket,
}: {
  lambda: Lambda;
  name: string;
  zipPath: string;
  bucket: string;
}): Promise<string | undefined> => {
  const functionCodeParams: Lambda.Types.UpdateFunctionCodeRequest = {
    FunctionName: name,
    Publish: true,
  };

  if (bucket) {
    functionCodeParams.S3Bucket = bucket;
    functionCodeParams.S3Key = path.basename(zipPath);
  } else {
    functionCodeParams.ZipFile = await readFile(zipPath);
  }
  const res = await lambda.updateFunctionCode(functionCodeParams).promise();

  return res.FunctionArn;
};

export const getLambda = async ({
  lambda,
  name,
}: {
  lambda: Lambda;
  name: string;
}): Promise<Partial<AwsLambdaInputs> | null> => {
  try {
    const res = await lambda
      .getFunctionConfiguration({
        FunctionName: name,
      })
      .promise();

    return {
      name: res.FunctionName,
      description: res.Description,
      timeout: res.Timeout,
      runtime: res.Runtime,
      role: {
        arn: res.Role as string,
      },
      handler: res.Handler,
      memory: res.MemorySize,
      hash: res.CodeSha256,
      env: res.Environment ? res.Environment.Variables : {},
      arn: res.FunctionArn,
    };
  } catch (e) {
    if (e.code === 'ResourceNotFoundException') {
      return null;
    }
    throw e;
  }
};

export const deleteLambda = async ({
  lambda,
  name,
}: {
  lambda: Lambda;
  name: string;
}): Promise<void> => {
  try {
    const params = { FunctionName: name };
    await lambda.deleteFunction(params).promise();
  } catch (error) {
    if (error.code !== 'ResourceNotFoundException') {
      throw error;
    }
  }
};

export const getPolicy = ({
  name,
  region,
  accountId,
}: {
  name: string;
  region: string;
  accountId: string;
}): Record<string, unknown> => {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Action: ['logs:CreateLogStream'],
        Resource: [`arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/${name}:*`],
        Effect: 'Allow',
      },
      {
        Action: ['logs:PutLogEvents'],
        Resource: [`arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/${name}:*:*`],
        Effect: 'Allow',
      },
    ],
  };
};

export const configChanged = (
  prevLambda: Record<string, unknown>,
  lambda: Record<string, unknown>
): boolean => {
  const keys = ['description', 'runtime', 'role', 'handler', 'memory', 'timeout', 'env', 'hash'];
  const inputs = pick(keys, lambda) as AwsLambdaInputs;
  inputs.role = { arn: inputs.role.arn }; // remove other inputs.role component outputs
  const prevInputs = pick(keys, prevLambda);

  return not(equals(inputs, prevInputs));
};

export const pack = async (code: string, shims = [], packDeps = true): Promise<unknown> => {
  if (utils.isArchivePath(code)) {
    return path.resolve(code);
  }

  let exclude: string[] = [];

  if (!packDeps) {
    exclude = ['node_modules/**'];
  }

  const outputFilePath = path.join(tmpdir(), `${Math.random().toString(36).substring(6)}.zip`);

  return packDir(code, outputFilePath, shims, exclude);
};
