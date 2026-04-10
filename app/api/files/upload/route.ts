import { put } from '@vercel/blob'

export const maxDuration = 60

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: 'Vercel Blob not configured. Set BLOB_READ_WRITE_TOKEN.' },
      { status: 503 }
    )
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
  }

  const blob = await put(file.name, file, { access: 'public' })

  return Response.json({
    url: blob.url,
    name: file.name,
    contentType: file.type,
    size: file.size,
  })
}
