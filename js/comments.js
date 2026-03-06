/**
 * Mudbrick — Comment Threading
 */

const AUTHOR_KEY = 'mudbrick_author_name';

export function getAuthorName() {
  return localStorage.getItem(AUTHOR_KEY) || 'Anonymous';
}

export function setAuthorName(name) {
  localStorage.setItem(AUTHOR_KEY, name || 'Anonymous');
}

export function createThread(author) {
  return {
    id: crypto.randomUUID(),
    author: author || getAuthorName(),
    created: new Date().toISOString(),
    status: 'open',
    replies: [],
  };
}

export function addReply(thread, text, author) {
  if (!thread || !text.trim()) return;
  thread.replies.push({
    id: crypto.randomUUID(),
    author: author || getAuthorName(),
    date: new Date().toISOString(),
    text: text.trim(),
  });
}

export function editReply(thread, replyId, newText) {
  const reply = thread?.replies?.find(r => r.id === replyId);
  if (reply) reply.text = newText;
}

export function deleteReply(thread, replyId) {
  if (!thread?.replies) return;
  thread.replies = thread.replies.filter(r => r.id !== replyId);
}

export function setThreadStatus(thread, status) {
  if (thread) thread.status = status;
}

/** Collect all threads across all pages. */
export function getAllThreads(pageAnnotations) {
  const threads = [];
  for (const [pageNum, json] of Object.entries(pageAnnotations)) {
    if (!json?.objects) continue;
    json.objects.forEach((obj, idx) => {
      if (obj.commentThread) {
        threads.push({
          pageNum: Number(pageNum),
          index: idx,
          type: obj.mudbrickType || 'unknown',
          text: obj.noteText || obj.text || '',
          thread: obj.commentThread,
        });
      }
    });
  }
  threads.sort((a, b) => new Date(b.thread.created) - new Date(a.thread.created));
  return threads;
}

/** Export all threads as XFDF-like XML string for interop. */
export function exportThreadsXFDF(pageAnnotations) {
  const threads = getAllThreads(pageAnnotations);
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<xfdf xmlns="http://ns.adobe.com/xfdf/">\n<annots>\n`;
  for (const t of threads) {
    xml += `  <text page="${t.pageNum - 1}" subject="${t.type}" date="${t.thread.created}" name="${t.thread.id}" title="${escapeXml(t.thread.author)}">\n`;
    xml += `    <contents>${escapeXml(t.text)}</contents>\n`;
    for (const r of t.thread.replies) {
      xml += `    <popup date="${r.date}" title="${escapeXml(r.author)}">${escapeXml(r.text)}</popup>\n`;
    }
    xml += `  </text>\n`;
  }
  xml += `</annots>\n</xfdf>`;
  return xml;
}

function escapeXml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
