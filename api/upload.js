import { put } from '@vercel/blob';

const MAX_SIZE = 4 * 1024 * 1024; // محدودیت بدنه درخواست در Vercel حدود 4.5MB است
const ALLOWED = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const filename = url.searchParams.get('filename') || '';
    const name = (url.searchParams.get('name') || '').slice(0, 100);
    const email = (url.searchParams.get('email') || '').slice(0, 150);
    const phone = (url.searchParams.get('phone') || '').slice(0, 30);
    const position = (url.searchParams.get('position') || '').slice(0, 100);

    if (!name || !email) {
      return json(400, { error: 'نام و ایمیل الزامی است.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { error: 'ایمیل واردشده معتبر نیست.' });
    }

    const ext = (filename.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
    if (!ALLOWED[ext]) {
      return json(400, { error: 'فقط فایل PDF یا Word (doc / docx) مجاز است.' });
    }

    const buffer = await request.arrayBuffer();
    if (buffer.byteLength === 0) {
      return json(400, { error: 'فایل خالی است.' });
    }
    if (buffer.byteLength > MAX_SIZE) {
      return json(413, { error: 'حجم فایل باید کمتر از ۴ مگابایت باشد.' });
    }

    const id = Date.now();

    const resume = await put(`resumes/${id}${ext}`, buffer, {
      access: 'private',
      contentType: ALLOWED[ext],
      addRandomSuffix: true,
    });

    await put(
      `resumes/${id}-info.json`,
      JSON.stringify({
        name,
        email,
        phone,
        position,
        originalFilename: filename,
        resumeUrl: resume.url,
        submittedAt: new Date().toISOString(),
      }),
      { access: 'private', contentType: 'application/json', addRandomSuffix: true }
    );

    return json(200, { ok: true });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Server error: ' + (err && err.message ? err.message : String(err)) });
  }
}
