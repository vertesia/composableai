# Environment Configurator

A command-line tool to easily configure Execution environments in Vertesia

## Features

- Configure an Execution Environment for AWS Bedrock using OpenID Connect (OIDC)
- Configure and Execution Environment for GCP Vertex AI using OpenID Connect (OIDC)

## Installation

### Prerequisites

- Git
- Node.js (v22 or higher)
- npm
- A Vertesia Account and [API Key](https://cloud.vertesia.io/settings#keys)

For AWS:

- [AWS CLI](https://aws.amazon.com/cli/)
- An AWS account with IAM write permissions

For GCP

- [Gcloud CLI](https://cloud.google.com/sdk/docs/install)
- A GCP account with IAM write permissions

### Setup

1. Clone this repository:

```bash
git clone https://github.com/vertesia/composableai.git
cd composableai/tools/environment-configuration
```

2. Install dependencies:

```bash
npm install
```

3. Install your API KEY in an environment file

```bash
cat << EOF > .env
VERTESIA_API_KEY=
EOF
```

or if you already have configured the [Vertesia CLI](https://docs.vertesiahq.com/cli), simply run

```bash
export VERTESIA_API_TOKEN=$(vertesia auth token)
```

## AWS Bedrock

First, refresh your credentials using the AWS CLI

```bash
aws sso login
```

Then run

```bash
npm run aws -- -r <AWS_REGION>
```

The list of all the parameters can be displayed using

```
npm run aws -- -h
```

Finally, activate models and select the default one in [Vertesia Studio](https://staging.cloud.vertesia.io/studio/environments)

## GCP Vertex AI

First, refresh your credentials using the gcloud CLI

```bash
gcloud auth application-default login
```

Then run

```bash
npm run gcp -- -r <GCP_REGION>
```

The list of all the parameters can be displayed using

```
npm run gcp -- -h
```

Finally, activate models and select the default one in [Vertesia Studio](https://staging.cloud.vertesia.io/studio/environments)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
