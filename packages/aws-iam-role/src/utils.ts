import { utils } from '@serverless/core';
import { IAM } from 'aws-sdk';
import { equals, isEmpty, has, not, pick, type } from 'ramda';

import { Policy, Role } from '../types';

export const addRolePolicy = async ({
  iam,
  name,
  policy,
}: {
  iam: IAM;
  name: string;
  policy: Policy;
}): Promise<void> => {
  if (has('arn', policy)) {
    await iam
      .attachRolePolicy({
        RoleName: name,
        PolicyArn: policy.arn,
      })
      .promise();
  } else if (!isEmpty(policy)) {
    await iam
      .putRolePolicy({
        RoleName: name,
        PolicyName: `${name}-policy`,
        PolicyDocument: JSON.stringify(policy),
      })
      .promise();
  }

  return utils.sleep(15000);
};

export const removeRolePolicy = async ({
  iam,
  name,
  policy,
}: {
  iam: IAM;
  name: string;
  policy: Policy;
}): Promise<void> => {
  if (has('arn', policy)) {
    await iam
      .detachRolePolicy({
        RoleName: name,
        PolicyArn: policy.arn,
      })
      .promise();
  } else if (!isEmpty(policy)) {
    await iam
      .deleteRolePolicy({
        RoleName: name,
        PolicyName: `${name}-policy`,
      })
      .promise();
  }
};

export const createRole = async ({
  iam,
  name,
  service,
  policy,
}: {
  iam: IAM;
  name: string;
  service: string | string[];
  policy: Policy;
}): Promise<string> => {
  const assumeRolePolicyDocument = {
    Version: '2012-10-17',
    Statement: {
      Effect: 'Allow',
      Principal: {
        Service: service,
      },
      Action: 'sts:AssumeRole',
    },
  };
  const roleRes = await iam
    .createRole({
      RoleName: name,
      Path: '/',
      AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicyDocument),
    })
    .promise();

  await addRolePolicy({
    iam,
    name,
    policy,
  });

  return roleRes.Role.Arn;
};

export const deleteRole = async ({
  iam,
  name,
  policy,
}: {
  iam: IAM;
  name: string;
  policy: Policy;
}): Promise<void> => {
  try {
    await removeRolePolicy({
      iam,
      name,
      policy,
    });
    await iam
      .deleteRole({
        RoleName: name,
      })
      .promise();
  } catch (error) {
    if (error.message !== `Policy ${policy.arn} was not found.` && error.code !== 'NoSuchEntity') {
      throw error;
    }
  }
};

export const getRole = async ({
  iam,
  name,
}: {
  iam: IAM;
  name: string;
}): Promise<null | undefined | Partial<Role>> => {
  try {
    const res = await iam.getRole({ RoleName: name }).promise();
    // todo add policy
    return {
      name: res.Role.RoleName,
      arn: res.Role.Arn,
      service: JSON.parse(decodeURIComponent(res.Role.AssumeRolePolicyDocument as string))
        .Statement[0].Principal.Service,
    };
  } catch (e) {
    if (e.message.includes('cannot be found')) {
      return null;
    }
    throw e;
  }
};

export const updateAssumeRolePolicy = async ({
  iam,
  name,
  service,
}: {
  iam: IAM;
  name: string;
  service: string | string[];
}): Promise<void> => {
  const assumeRolePolicyDocument = {
    Version: '2012-10-17',
    Statement: {
      Effect: 'Allow',
      Principal: {
        Service: service,
      },
      Action: 'sts:AssumeRole',
    },
  };
  await iam
    .updateAssumeRolePolicy({
      RoleName: name,
      PolicyDocument: JSON.stringify(assumeRolePolicyDocument),
    })
    .promise();
};

export const inputsChanged = (prevRole: Role, role: Role): boolean => {
  // todo add name and policy
  const inputs = pick(['service'], role);
  const prevInputs = pick(['service'], prevRole);

  if (type(inputs.service) === 'Array') {
    //@ts-ignore
    inputs?.service?.sort();
  }
  if (type(prevInputs.service) === 'Array') {
    //@ts-ignore
    prevInputs?.service?.sort();
  }

  return not(equals(inputs, prevInputs));
};
