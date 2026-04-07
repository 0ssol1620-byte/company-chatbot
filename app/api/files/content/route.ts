export const maxDuration = 30

const TEXT_TYPES = ['text/', 'application/json', 'application/xml', 'application/markdown']

export async function POST(req: Request) {
  const { blobUrl } = await req.json()

  if (!blobUrl || typeof blobUrl !== 'string') {
    return Response.json({ error: 'blobUrl is required' }, { status: 400 })
  }

  try {
    const res = await fetch(blobUrl)
    if (!res.ok) {
      return Response.json({ error: 'Failed to fetch file' }, { status: 502 })
    }

    const contentType = res.headers.get('content-type') ?? ''
    const isText = TEXT_TYPES.some((t) => contentType.includes(t))

    if (!isText) {
      return Response.json({ text: '' })
    }

    const text = await res.text()
    // Limit to 50k chars to avoid token overflow
    return Response.json({ text: text.slice(0, 50_000) })
  } catch {
    return Response.json({ error: 'Content extraction failed' }, { status: 500 })
  }
}
