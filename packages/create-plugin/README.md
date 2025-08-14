# @vertesia/create-agent

This package is scaffolding a vertesia agent project.
Vertesia agents are used to deploy custom workflows to Vertesia cloud.

Visit https://vertesiahq.com for more information about Vertesia.

## Requirements:
1. docker (with buildx support) installed locally.
2. vertesia CLI application. The CLI will be automatically installed when initializing the agent project if you didn't installed it previously.

## Initialize a Vertesia agent project

Run the command line command:

```
npm init @vertesia/agent
```

Follow the instructions on screen. You need to define an organization and a name for your agent. The organization must be unique inside Vertesia and is usually the name of your Vertesia organization account. The agent name is identifying the project in your organization.

The generated project is a typescript project and is using [Temporal](https://temporal.io/) as the workflow system.

You can implement your own workflows and activities anywhere in the src/ directory or even in a dependency project. The only requirement is that you need to export the workflows and the activities from the `src/workflow.ts` and `src/activities.ts` files.
These generated files are containing a "Hello world!" workflow and activity as an example that you should remove and export your own definitions.


## Developing your agent workflows / activities.

Export your temporal workflows `from src/workflows.ts` and your activities from `src/activities.ts`

## Test locally the workflows.

There are two ways to test the agent worker:

1. Using `npm start`. This will start the worker in your terminal.
2. Using `vertesia agent run` from your project root. This will run the agent worker in side the docker image you previously built. See the [Build](build-the-agent-docker-image) section.

**Important Note:** All `vertesia agent` commands must be executed in the agent project root.

## Debugging locally the workflows.

You can debug the workflows by replaying them locally using the temporal replayer that you can found in  `src/debug-replayer.ts`.

See https://docs.temporal.io/develop/typescript/debugging for more information

## Packaging and publishing your Vertesia agent

When the workflows are working you will want to publish the agent to Vertesia.
The agent should be packaged as a docker image and then published to the Vertesia cloud.

### Build the agent docker image

When you are ready to test the agent image you can built it using `vertesia agent build` from you project root.

This will build a docker image tagged as `your-organization/your-agent-name:latest`.
This image is only useable to test locally. You cannot push it to Vertesia.

### Releasing the agent docker image

When you already to push your agent to Vertesia you must first create a version using the following command:

```
vertesia agent release <version>
```

The version must be in the `major.minor.patch[-modifier]` format. \
Examples: `1.0.0`, `1.0.0-rc1`.

This command is creating a new docker tag `your-organization/your-agent-name:version` from the `latest` image tag.

### Publishing the agent docker image to Vertesia

Versioned images (using the `release` command) can be published to Vertesia. This can be done using the following command:

```
vertesia agent publish <version>
```

where the version is the version of the image tag you want to publish.

You can also only push the image to vertesia without deploying the agent by using the `--push-only` flag:

```
vertesia agent publish <version> --push-only
```

The you can deploy an agent that you previously uploaded to Vertesia by using the command:

```
vertesia agent publish <version> --deploy-only
```

## Managing agent versions

You can see the docker image versions you created using the following command:

```
vertesia agent versions
```
