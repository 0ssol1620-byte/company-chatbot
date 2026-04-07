export const maxDuration = 60

export async function POST() {
  // Vercel Blob is not configured in this environment.
  // To enable: install @vercel/blob, add BLOB_READ_WRITE_TOKEN to your env,
  // and update this route to use the put() function from @vercel/blob.
  return Response.json(
    {
      error:
        'File upload requires Vercel Blob. Run `npm install @vercel/blob`, set BLOB_READ_WRITE_TOKEN, then update this route.',
    },
    { status: 503 }
  )
}
