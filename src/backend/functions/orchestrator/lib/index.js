const AWS = require('aws-sdk');
const R = require('ramda');
const converter = AWS.DynamoDB.Converter;

// o is similar to R.compose but takes exactly two arguments
const {o} = R;

// compose that works on promise returning functions
const composeP = (...fns) => R.composeWith(R.then)(fns);

// snakeToCamel :: String -> String
const snakeToCamel = R.replace(/([_][a-z])/g, o(R.replace('_', ''), R.toUpper));

// pascalToCamel :: String -> String
const pascalToCamel = R.replace(/^\w/g, R.toLower);

// keyConverter :: (String -> String) -> {k: v} -> {k: v}
const keyConverter = f => R.compose(R.fromPairs, R.map(R.adjust(0, f)), R.toPairs);

function noop() {
   return Promise.resolve({});
}

// convertEnvVars :: {k: v} -> {k: v}
const convertEnvVars = R.pipe(
    keyConverter(o(snakeToCamel, R.toLower)),
    R.evolve({subnets: subnets => [...subnets.split(',').map(R.trim)]})
);

// convertImage :: {k: v} -> {k: v}
const convertImage = keyConverter(pascalToCamel);

// stopTranscription :: AWS.ECS -> {k: v} -> Promise {k: v}
const stopTranscription = R.curry((ecs, {mediaUrl, cluster, taskArn, tasksTableName}) => {
   return ecs.stopTask({cluster, task: taskArn})
       .promise()
       .then(() => ({mediaUrl, tasksTableName}));
});

// createEnrichedError :: {k: v} -> Error -> Error
const createEnrichedError = R.curry((params, err) => {
   return R.reduce((e, [k, v]) => (e[k] = v, e), R.clone(err), R.toPairs(params))
});

// startTranscription :: AWS.ECS -> {k: v} -> Promise {k: v}
const startTranscription = R.curry((ecs, {cluster, taskName, tasksTableName, mediaUrl, subnets}) => {
   const params = {
      taskDefinition: taskName,
      cluster: cluster,
      launchType: 'FARGATE',
      networkConfiguration: {
         awsvpcConfiguration: {
            subnets: subnets,
            assignPublicIp: 'ENABLED'
         }
      },
      overrides: {
         containerOverrides: [
            {
               name: 'transcriber',
               environment: [
                  {
                     name: 'MEDIA_URL',
                     value: mediaUrl
                  }
               ]
            }
         ]
      }
   };

   return ecs.runTask(params)
       .promise()
       .then(({tasks}) => {
          console.log(`Task started: ${tasks[0].taskArn}`);
          return {tasksTableName, mediaUrl, taskArn: tasks[0].taskArn}
       })
});

// updateWaiting :: ({k: v} -> Promise {k: v}) -> {k: v} -> Promise {k: v}
const updateWaiting = R.curry((updateItem, {tasksTableName, mediaUrl, taskArn}) => {
   const status = 'INITIALIZING';

   const params = {
      TableName: tasksTableName,
      Key: {
         MediaUrl: mediaUrl
      },
      UpdateExpression: 'SET TaskStatus = :status, TaskArn = :task',
      ExpressionAttributeValues: {
         ':status':  status,
         ':task': taskArn
      },
      ReturnValues: 'ALL_NEW'
   };

   return updateItem(params)
       .catch(err => {
          console.log(`Updating DynamoDb with ${status} state has failed`);
          throw createEnrichedError({taskArn}, err)
       })
       .then(({Attributes}) => ({...Attributes, tasksTableName}))
});

// waiting :: AWS.ECS -> ({k:v} -> Promise {k: v}) -> {k: v} -> Promise {k:v}
const waiting = R.curry((ecs, updateItem) => composeP(updateWaiting(updateItem), startTranscription(ecs)));

// terminating :: AWS.ECS -> {k: v} -> Promise {k:v}
const terminating = stopTranscription;

// createDeleteParams :: {k: v} -> {k: v}
function createDeleteParams({mediaUrl, tasksTableName}) {
   return {
      TableName: tasksTableName,
      Key: {
         MediaUrl: mediaUrl
      }
   };
}

// terminated :: ({k:v} -> Promise {k: v}) -> {k: v} -> {k: v} -> Promise {k:v}
const terminated = R.curry(deleteItem => o(deleteItem, createDeleteParams));

// unrecoverableError :: ({k:v} -> Promise {k: v}) -> {k: v} -> Promise {k:v}
const unrecoverableError = R.curry((updateItem, {tasksTableName, mediaUrl}) => {
   const params = {
      TableName: tasksTableName,
      Key: {
         MediaUrl: mediaUrl
      },
      UpdateExpression: 'SET TaskStatus = :status',
      ExpressionAttributeValues: {
         ':status':  'UNRECOVERABLE_ERROR'
      },
      ReturnValues: 'ALL_NEW'
   };

   return updateItem(params);
});

// error :: ({k: v} -> Promise {k: v}) -> {k: v} -> Promise {k: v}
const error = R.curry((updateItem, {tasksTableName, mediaUrl}) => {
   const params = {
      TableName: tasksTableName,
      Key: {
         MediaUrl: mediaUrl
      },
      UpdateExpression: 'ADD Retries :val SET TaskStatus = :status',
      ExpressionAttributeValues: {
         ':val': 1,
         ':status':  'WAITING'
      },
      ReturnValues: 'ALL_NEW'
   };

   return updateItem(params)
       .then(({Attributes}) => ({...Attributes, tasksTableName}))
});

// isUnrecoverableError :: Number -> Number -> String -> Boolean
function isUnrecoverableError(retries, retryThreshold, taskStatus) {
   return retries > retryThreshold && !R.includes(taskStatus, ['TERMINATING', 'TERMINATED']);
}

// handler :: AWS.ECS -> AWS.DynamoDB -> {k: v} -> ({k: v} -> Promise {k: v})
module.exports = (ecs, ddb, env) => {
   const update = params => ddb.update(params).promise();

   const handlers = {
      WAITING: waiting(ecs, update),
      INITIALIZING: noop,
      PROCESSING: noop,
      TERMINATING: terminating(ecs),
      TERMINATED: terminated(params => ddb.delete(params).promise()),
      ERROR: error(update),
      UNRECOVERABLE_ERROR: noop
   };

   const normalisedEnv = convertEnvVars(env);

   return event => {

      const promises = R.map(record => {
         const image = converter.unmarshall(R.path(['dynamodb', 'NewImage'], record));

         if(R.isEmpty(image)) return Promise.resolve({}); // this means we've a delete event

         const params = R.mergeRight(normalisedEnv, convertImage(image));

         const {mediaUrl, retries = 0, taskStatus, tasksTableName, retryThreshold = '3'} = params;

         console.log(`Status: ${taskStatus}`);

         if(taskStatus === 'UNRECOVERABLE_ERROR') return Promise.resolve({});

         if(isUnrecoverableError(retries, R.defaultTo(3, parseInt(retryThreshold)), taskStatus)) {
            console.log(`Error threshold exceeded. Retries: ${retries}`);
            return unrecoverableError(update, {mediaUrl, tasksTableName})
         }

         const handler = R.defaultTo(noop, handlers[taskStatus]);
         return handler(params)
             .catch(createEnrichedError({tasksTableName, mediaUrl}));
      }, event.Records);

      return Promise.all(promises)
          .then(R.filter(x => x.name === 'Error'))
          .then(R.map(err => {
             const {mediaUrl, tasksTableName} = err;

             const stop = err.taskArn != null ?
                 stopTranscription(ecs, {mediaUrl, cluster: normalisedEnv.cluster, taskArn: err.taskArn, tasksTableName})
                     .then(() => console.log(`${err.taskArn} stopped`)) :
                 Promise.resolve({});

             return stop.then(() => unrecoverableError(update, {tasksTableName, mediaUrl}));
          }))
          .then(promises => Promise.all(promises))
   };
};
