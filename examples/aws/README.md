An example of a fully functional Next.js deployment to AWS can be found [here](https://github.com/nidratech/next-deploy-aws-demo).

You can see it in action on AWS [here](https://d1glu8cqlkaas6.cloudfront.net).

The key part is its `next.config.js` configuration:

```javascript
module.exports = {
  engine: 'aws',
  debug: true,
  bucketName: 'next-deploy-demo-bucket',
  description: {
    requestLambda: 'Next deploy demo request lambda.',
  },
  name: {
    requestLambda: 'request-handler-demo',
  },
  stage: {
    name: 'demo',
    versioned: true,
    bucketName: 'next-deploy-demo-environments',
  },
};
```
