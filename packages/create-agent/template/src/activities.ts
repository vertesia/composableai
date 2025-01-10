import { log } from "@temporalio/activity";

// Export your activity functions here

export async function helloActivity() {
    log.info("Hello, World!");
}
