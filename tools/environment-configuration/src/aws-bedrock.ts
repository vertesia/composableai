import {
  IAMClient,
  CreateOpenIDConnectProviderCommand,
  CreateRoleCommand,
  AttachRolePolicyCommand,
} from "@aws-sdk/client-iam";
import { VertesiaClient } from "@vertesia/client";
import { SupportedProviders } from "@vertesia/common";
import { VERTESIA_STS, VERTESIA_PROVIDER_URL, delay } from "./common.js";

const defaultTags = [
  {
    Key: "Application",
    Value: "Vertesia",
  },
];

export async function configureBedrockEnvironment(
  vertesia: VertesiaClient,
  region: string,
  envName: string,
  roleName: string,
  tags: Array<{ Key: string; Value: string }>,
): Promise<void> {
  const effectiveTags = tags && tags.length ? tags : defaultTags;

  // 1. Get Organization and Project from Vertesia
  const account = await vertesia.account.info();
  console.log(`Using Vertesia Organization ID: ${account.id} ${account.name}`);

  const projects = await vertesia.projects.list();
  if (projects?.length === 0) {
    console.error("No Vertesia projects found.");
    process.exit(1);
  }

  const project = projects[0];
  console.log(`Using Vertesia Project: ${project.id} ${project.name}`);

  // 2. Create AWS Client
  const iamClient = new IAMClient({ region: region });

  // 3. Configure OIDC Provider (Check if already exists, create if not)
  const providerArn = await createOIDCProvider(iamClient, effectiveTags);
  console.log(`Created OIDC Provider with ARN: ${providerArn}`);

  // 4. Configure a new Vertesia Execution Environment
  let environment = await vertesia.environments.create({
    name: envName,
    provider: SupportedProviders.bedrock,
    endpoint_url: region,
    allowed_projects: [project.id],
  });
  console.log(
    `Created Vertesia Environment with ID: ${environment.id} ${environment.name}`,
  );

  // 5. Configure an AWS IAM Role
  const roleArn = await createIAMRole(
    iamClient,
    account.id,
    environment.id,
    providerArn,
    roleName,
    effectiveTags,
  );
  console.log(`Created IAM Role with ARN: ${roleArn}`);

  // 6. Finalize the Vertesia Execution Environment Configuration
  environment = await vertesia.environments.update(environment.id, {
    apiKey: roleArn,
  });
  console.log("Vertesia Environment updated successfully with AWS Role ARN.");

  // 7. Verify access to Bedrock models
  console.log("Waiting for models");
  await delay(30000);

  const availableModels = await vertesia.environments.listModels(
    environment.id,
  );
  console.log("Available models from Bedrock:", availableModels);
}

const createOIDCProvider = async (
  iamClient: IAMClient,
  tags: Array<{ Key: string; Value: string }>,
): Promise<string> => {
  const providerURL = VERTESIA_PROVIDER_URL;
  const audience = "bedrock";

  try {
    const command = new CreateOpenIDConnectProviderCommand({
      ClientIDList: [audience],
      Url: providerURL,
      Tags: tags,
    });
    const response = await iamClient.send(command);

    if (!response.OpenIDConnectProviderArn) {
      throw new Error("OIDC Provider ARN is undefined.");
    } else {
      return response.OpenIDConnectProviderArn;
    }
  } catch (error: unknown) {
    console.error("Error creating OIDC Provider:", error);
    throw error;
  }
};

const createIAMRole = async (
  iamClient: IAMClient,
  organizationId: string,
  environmentId: string,
  providerArn: string,
  roleName: string,
  tags: Array<{ Key: string; Value: string }>,
): Promise<string> => {
  const condition: Record<string, string> = {};
  const key = `${VERTESIA_STS}:sub`;
  condition[key] = `env:${organizationId}:${environmentId}`;

  const assumeRolePolicyDocument = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: {
          Federated: providerArn,
        },
        Action: "sts:AssumeRoleWithWebIdentity",
        Condition: {
          StringEquals: condition,
        },
      },
    ],
  });

  try {
    const createRoleCommand = new CreateRoleCommand({
      RoleName: roleName,
      AssumeRolePolicyDocument: assumeRolePolicyDocument,
      Description: "Role for Vertesia to access Bedrock",
      Tags: tags,
    });
    const createRoleResponse = await iamClient.send(createRoleCommand);
    const roleArn = createRoleResponse.Role?.Arn;

    // Attach a policy to the role (e.g., AmazonBedrockFullAccess)
    if (roleArn) {
      const policyArn = "arn:aws:iam::aws:policy/AmazonBedrockFullAccess"; // Or your custom policy ARN
      await attachRolePolicy(iamClient, roleName, policyArn);
      console.log(
        `Successfully attached policy ${policyArn} to role ${roleName}`,
      );
      return roleArn;
    } else {
      throw new Error("Role ARN is undefined.");
    }
  } catch (error) {
    console.error("Error creating IAM Role:", error);
    throw error;
  }
};

const attachRolePolicy = async (
  iamClient: IAMClient,
  roleName: string,
  policyArn: string,
): Promise<void> => {
  try {
    const command = new AttachRolePolicyCommand({
      RoleName: roleName,
      PolicyArn: policyArn,
    });
    await iamClient.send(command);
  } catch (error) {
    console.error(`Error attaching policy to role:`, error);
    throw error;
  }
};
