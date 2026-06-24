import { isAuthenticatedRequest } from '../lib/axisAuth.js';
import { supabaseHeaders, supabaseRequest } from '../lib/supabaseServer.js';

const BUCKET = 'axis_files';

function decodeIncomingBinary(binaryBase64, mimeType = 'application/octet-stream') {
  if (!binaryBase64) return null;
  let payload = binaryBase64;
  let detectedMime = mimeType;

  const dataUrlMatch = String(binaryBase64).match(/^data:([^;]+);base64,(.+)$/);
  if (dataUrlMatch) {
    detectedMime = dataUrlMatch[1] || mimeType;
    payload = dataUrlMatch[2];
  }

  return {
    mimeType: detectedMime,
    buffer: Buffer.from(payload, 'base64')
  };
}

async function uploadToStorage(storagePath, binaryBase64, mimeType) {
  const decoded = decodeIncomingBinary(binaryBase64, mimeType);
  if (!decoded) throw new Error('BINARY PAYLOAD REQUIRED');

  const { buffer, mimeType: finalMime } = decoded;
  const headers = supabaseHeaders({
    'Content-Type': finalMime,
    'x-upsert': 'true'
  });

  const bucketUrl = `${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`;
  const response = await fetch(bucketUrl, {
    method: 'POST',
    headers,
    body: buffer
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text.slice(0, 220) || 'STORAGE UPLOAD FAILED');
  }

  try {
    return JSON.parse(text);
  } catch {
    return { ok: true };
  }
}

async function downloadFromStorage(storagePath) {
  const headers = supabaseHeaders();
  const url = `${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`;
  const response = await fetch(url, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.slice(0, 220) || 'STORAGE DOWNLOAD FAILED');
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return { base64, contentType };
}

export default async function handler(req, res) {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  if (req.method === 'GET') {
    try {
      const action = String(req.query?.action || '').trim().toLowerCase();
      if (action === 'file') {
        const id = String(req.query?.id || '').trim();
        if (!id) return res.status(400).json({ ok: false, error: 'BOOK ID REQUIRED' });

        const rows = await supabaseRequest(`library_books?id=eq.${encodeURIComponent(id)}&select=id,storage_path,book_type,title,author`);
        const book = Array.isArray(rows) ? rows[0] : rows;
        if (!book?.storage_path) {
          return res.status(404).json({ ok: false, error: 'BOOK FILE NOT FOUND' });
        }

        const file = await downloadFromStorage(book.storage_path);
        return res.status(200).json({
          ok: true,
          id: book.id,
          bookType: book.book_type,
          title: book.title,
          author: book.author,
          contentType: file.contentType,
          binaryBase64: file.base64
        });
      }

      const rows = await supabaseRequest('library_books?select=id,title,author,book_type,curr_page,total_pages,carry_forward,storage_path,created_at&order=created_at.desc&limit=100');
      return res.status(200).json({ ok: true, rows: rows || [] });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'FAILED TO LOAD LIBRARY' });
    }
  }

  if (req.method === 'POST') {
    try {
      const action = String(req.body?.action || '').trim().toLowerCase();

      if (action === 'delete') {
        const id = String(req.body?.id || '').trim();
        if (!id) return res.status(400).json({ ok: false, error: 'BOOK ID REQUIRED' });

        const rows = await supabaseRequest(`library_books?id=eq.${encodeURIComponent(id)}&select=id,storage_path`);
        const book = Array.isArray(rows) ? rows[0] : rows;
        if (book?.storage_path) {
          const headers = supabaseHeaders();
          await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${book.storage_path}`, { method: 'DELETE', headers });
        }
        await supabaseRequest(`library_books?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
        return res.status(200).json({ ok: true, message: 'BOOK DELETED' });
      }

      if (action === 'progress') {
        const id = String(req.body?.id || '').trim();
        if (!id) return res.status(400).json({ ok: false, error: 'BOOK ID REQUIRED' });
        const payload = {
          curr_page: Number(req.body?.currPage || 0),
          carry_forward: !!req.body?.carryForward
        };
        const rows = await supabaseRequest(`library_books?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: payload
        });
        return res.status(200).json({ ok: true, row: Array.isArray(rows) ? rows[0] : rows });
      }

      const bookId = String(req.body?.id || `lib-${Date.now()}`).trim();
      const title = String(req.body?.title || '').trim();
      const author = String(req.body?.author || 'AXIS ACTUAL').trim();
      const bookType = String(req.body?.bookType || '').trim().toLowerCase();
      const currPage = Number(req.body?.currPage || 0);
      const totalPages = Number(req.body?.totalPages || 0) || (bookType === 'pdf' ? 150 : 320);
      const carryForward = !!req.body?.carryForward;
      const binaryBase64 = req.body?.binaryBase64 || '';
      const mimeType = String(req.body?.mimeType || '').trim() || (bookType === 'pdf' ? 'application/pdf' : 'application/epub+zip');

      if (!title || !bookType) {
        return res.status(400).json({ ok: false, error: 'TITLE AND BOOK TYPE REQUIRED' });
      }
      if (!['pdf', 'epub'].includes(bookType)) {
        return res.status(400).json({ ok: false, error: 'BOOK TYPE MUST BE PDF OR EPUB' });
      }
      if (!binaryBase64) {
        return res.status(400).json({ ok: false, error: 'BOOK BINARY REQUIRED' });
      }

      const storagePath = `library/${bookId}.${bookType === 'pdf' ? 'pdf' : 'epub'}`;
      await uploadToStorage(storagePath, binaryBase64, mimeType);

      const rows = await supabaseRequest('library_books?on_conflict=id', {
        method: 'POST',
        headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: {
          id: bookId,
          title,
          author,
          book_type: bookType,
          curr_page: currPage,
          total_pages: totalPages,
          carry_forward: carryForward,
          storage_path: storagePath
        }
      });

      return res.status(200).json({ ok: true, row: Array.isArray(rows) ? rows[0] : rows });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'FAILED TO SAVE LIBRARY BOOK' });
    }
  }

  return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
}