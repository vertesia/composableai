/**
 * Vercel Serverless Function Adapter
 *
 * This adapter allows the Hono server to run as a Vercel serverless function.
 * All HTTP methods are forwarded to the Hono app's fetch handler.
 */
import app from '../lib/server.js';

export async function GET(request) {
  return await app.fetch(request);
}

export async function POST(request) {
  return await app.fetch(request);
}

export async function PUT(request) {
  return await app.fetch(request);
}

export async function PATCH(request) {
  return await app.fetch(request);
}

export async function DELETE(request) {
  return await app.fetch(request);
}

export async function OPTIONS(request) {
  return await app.fetch(request);
}
