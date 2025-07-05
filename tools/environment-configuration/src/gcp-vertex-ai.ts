import { AnyAuthClient, GoogleAuth } from "google-auth-library";
import { VertesiaClient } from "@vertesia/client";
import { delay, VERTESIA_PROVIDER_URL } from "./common.js";
import { SupportedProviders } from "@vertesia/common";

export const configureVertexAiEnvironment = async (
  vertesia: VertesiaClient,
  envName: string,
  region: string,
  poolName: string,
  providerName: string,
  gcpProjectId?: string,
): Promise<void> => {
  // 1. Get Organization and Project from Vertesia
  const account = await vertesia.account.info();
  console.log(`Using Vertesia Organization ID: ${account.id} ${account.name}`);

  const projects = await vertesia.projects.list();
  if (projects?.length === 0) {
    throw "No Vertesia projects found.";
  }

  const vertesiaProject = projects[0];
  console.log(
    `Using Vertesia Project: ${vertesiaProject.id} ${vertesiaProject.name}`,
  );

  // 1. Create a new Vertesia Execution Environment
  let environment = await vertesia.environments.create({
    name: envName,
    provider: SupportedProviders.vertexai,
    allowed_projects: [vertesiaProject.id],
  });
  console.log(
    `Created Vertesia Environment with ID: ${environment.id} ${environment.name}`,
  );

  // 2. Get GCP client and project
  const auth = new GoogleAuth({
    scopes: [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/iam",
    ],
    projectId: gcpProjectId,
  });

  const gcp = await auth.getClient();
  const projectId = await auth.getProjectId();
  console.log(`Found GCP Project ID: ${projectId}`);

  // 3. Check if pool already exists. if not create it
  const pool = await getOrCreatePool(gcp, projectId, poolName);

  // 4. Check if provider already exists. if not create it
  const provider = await getOrCreateProvider(
    gcp,
    projectId,
    poolName,
    providerName,
  );

  // 5. Create policy binding
  let binding = await gcp.request({
    url: `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`,
    method: "POST",
  });

  const policy = binding.data;

  policy.bindings.push({
    role: "roles/aiplatform.user",
    members: [
      `principal://iam.googleapis.com/${pool.name}/subject/env:${account.id}:${environment.id}`,
    ],
  });

  binding = await gcp.request({
    url: `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:setIamPolicy`,
    method: "POST",
    data: {
      policy: policy,
    },
  });

  // 6. Finalize the Vertesia Execution Environment Configuration
  environment = await vertesia.environments.update(environment.id, {
    apiKey: `https://iam.googleapis.com/${provider.name}`,
    endpoint_url: `${region}:${projectId}`,
  });
  console.log("Vertesia Environment updated successfully");

  // 7. List available models
  console.log("Waiting for models");
  await delay(60000);

  const availableModels = await vertesia.environments.listModels(
    environment.id,
  );
  console.log("Available models from VertexAI:", availableModels);
};

const getOrCreatePool = async (
  gcp: AnyAuthClient,
  projectId: string,
  poolName: string,
) => {
  let pool;

  try {
    const { data } = await gcp.request({
      url: `https://iam.googleapis.com/v1/projects/${projectId}/locations/global/workloadIdentityPools/${poolName}`,
    });
    pool = data;
  } catch (error) {
    if (error.response.status !== 404) {
      throw error;
    }
  }

  if (pool) {
    if (pool.state === "ACTIVE") {
      console.log("Workload Identity Pool already exists. Skipping creation.");
      return pool;
    } else {
      throw new Error(
        `Workload Identity Pool ${poolName} is ${pool.state}. Please check the pool state.`,
      );
    }
  } else {
    const { data } = await gcp.request({
      url: `https://iam.googleapis.com/v1/projects/${projectId}/locations/global/workloadIdentityPools`,
      method: "POST",
      params: {
        workloadIdentityPoolId: poolName,
      },
      data: {
        displayName: poolName,
      },
    });

    const operationName = data.name;
    console.log("Waiting for pool creation operation to complete...");
    const done = await waitForOperation(gcp, operationName);
    if (!done) {
      throw new Error("Pool creation Operation takes too long. Aborting");
    }

    // get pool details
    const response = await gcp.request({
      url: `https://iam.googleapis.com/v1/projects/${projectId}/locations/global/workloadIdentityPools/${poolName}`,
    });

    return response.data;
  }
};

const getOrCreateProvider = async (
  gcp: AnyAuthClient,
  projectId: string,
  poolName: string,
  providerName: string,
) => {
  // check if provider already exists. if not create it
  let provider;

  try {
    const { data } = await gcp.request({
      url: `https://iam.googleapis.com/v1/projects/${projectId}/locations/global/workloadIdentityPools/${poolName}/providers/${providerName}`,
    });
    provider = data;
  } catch (error) {
    if (error.response.status !== 404) {
      throw error;
    }
  }

  if (provider) {
    console.log("Identity Provider already exists. Skipping creation.");
    return provider;
  } else {
    const { data } = await gcp.request({
      url: `https://iam.googleapis.com/v1/projects/${projectId}/locations/global/workloadIdentityPools/${poolName}/providers`,
      method: "POST",
      params: {
        workloadIdentityPoolProviderId: providerName,
      },
      data: {
        displayName: providerName,
        attributeMapping: {
          "google.subject": "assertion.sub",
          "attribute.account": "assertion.account.id",
          "attribute.project": "assertion.project.id",
          "attribute.name": "assertion.name",
        },
        oidc: {
          issuerUri: VERTESIA_PROVIDER_URL,
        },
      },
    });

    const operationName = data.name;
    console.log("Waiting for provider create operation to complete...");
    const done = await waitForOperation(gcp, operationName);
    if (!done) {
      throw new Error("Provider creation Operation takes too long. Aborting");
    }

    // get provider details
    const response = await gcp.request({
      url: `https://iam.googleapis.com/v1/projects/${projectId}/locations/global/workloadIdentityPools/${poolName}/providers/${providerName}`,
    });

    return response.data;
  }
};

const waitForOperation = async (gcp: AnyAuthClient, operationName: string) => {
  const tries = 0;
  let pause = 3000;
  let status = false;
  do {
    await delay(pause);
    pause = pause * 2;
    const response = await gcp.request({
      url: `https://iam.googleapis.com/v1/${operationName}`,
    });
    status = response.data.done;
  } while (tries < 5 && !status);
  return status;
};
