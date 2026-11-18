async function request(action, body = {}) {
  const context = await window.WashDeskCloud?.getApiContext?.();
  if (!context?.url || !context?.anonKey || !context?.accessToken) {
    throw new Error('Connect this device to the shared Prime Auto Care cloud before using Google Reviews.');
  }
  const response = await fetch(`${context.url}/functions/v1/google-review-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: context.anonKey,
      Authorization: `Bearer ${context.accessToken}`
    },
    body: JSON.stringify({ action, ...body })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || `Google Review service returned HTTP ${response.status}.`);
    error.status = response.status;
    error.details = result.details || null;
    throw error;
  }
  return result;
}

window.PrimeAutoCareGoogleReviews = {
  status: () => request('status'),
  list: () => request('reviews'),
  saveSettings: settings => request('save-settings', { settings }),
  connect: () => request('connect'),
  sync: () => request('sync'),
  enableNotifications: () => request('enable-notifications'),
  logInvitation: entry => request('log-invitation', entry),
  chat: question => request('level1-chat', { question }),
  analyze: reviewId => request('level2-analyze', { review_id: reviewId }),
  copilot: () => request('level3-copilot'),
  publish: (draftId, approved) => request('publish-reply', { draft_id: draftId, approved: approved === true }),
  aiGenerate: payload => request('ai-generate', payload),
  listGrowthPosts: () => request('list-growth-posts'),
  listGrowthKeywords: () => request('list-growth-keywords'),
  saveGrowthPost: post => request('save-growth-post', { post }),
  saveGrowthKeywords: ideas => request('save-growth-keywords', { ideas }),
  uploadGrowthPhoto: async (postId, file) => {
    if (!(file instanceof File) || !['image/jpeg','image/png'].includes(file.type)) throw new Error('Choose a JPG or PNG photo.');
    if (file.size < 10 * 1024 || file.size > 5 * 1024 * 1024) throw new Error('Photo must be between 10 KB and 5 MB.');
    if (typeof createImageBitmap === 'function') { const bitmap = await createImageBitmap(file); const width = bitmap.width, height = bitmap.height; bitmap.close?.(); if (width < 250 || height < 250) throw new Error('Google photos must be at least 250 × 250 pixels.'); }
    const bytes = new Uint8Array(await file.arrayBuffer()); let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return request('upload-growth-photo', { post_id: postId, mime_type: file.type, image_base64: btoa(binary) });
  },
  publishGrowthPost: (postId, approved) => request('publish-growth-post', { post_id: postId, approved: approved === true }),
  deleteGrowthPost: postId => request('delete-growth-post', { post_id: postId })
};

window.PrimeAutoCareGoogleReviewQr = {
  async downloadCounterPoster(profileUrl, businessName = 'Prime Auto Care') {
    const pdfMake = window.pdfMake;
    if (!pdfMake?.createPdf) throw new Error('The PDF engine is not ready. Reopen Prime Auto Care and try again.');
    const target = String(profileUrl || '').trim();
    if (!/^https:\/\//i.test(target)) throw new Error('Save the Google Business Profile link first.');
    const definition = {
      info: { title: 'Prime Auto Care Google Review QR', author: 'Prime Auto Care' },
      pageSize: 'A5',
      pageMargins: [30, 32, 30, 30],
      content: [
        { text: businessName.toUpperCase(), alignment: 'center', fontSize: 19, bold: true, color: '#17130c', characterSpacing: 1.1, margin: [0, 0, 0, 7] },
        { text: 'PROFESSIONAL CARE · PREMIUM SHINE', alignment: 'center', fontSize: 8, color: '#8a6628', characterSpacing: 1.2, margin: [0, 0, 0, 22] },
        { qr: target, fit: 245, alignment: 'center', foreground: '#17130c', background: '#ffffff', eccLevel: 'H' },
        { text: 'SCAN TO VISIT OUR GOOGLE PROFILE', alignment: 'center', fontSize: 11, bold: true, color: '#17130c', margin: [0, 22, 0, 8] },
        { text: 'We welcome your honest feedback. Every opinion is valuable and reviews are completely optional.', alignment: 'center', fontSize: 9, color: '#62563f', lineHeight: 1.35, margin: [12, 0, 12, 20] },
        { text: 'Thank you for choosing Prime Auto Care', alignment: 'center', fontSize: 10, bold: true, color: '#8a6628', margin: [0, 8, 0, 0] }
      ],
      background: (page, size) => ({ canvas: [{ type: 'rect', x: 12, y: 12, w: size.width - 24, h: size.height - 24, lineWidth: 1.2, lineColor: '#c5a15d' }] })
    };
    await new Promise((resolve, reject) => {
      try {
        pdfMake.createPdf(definition).getBlob(blob => {
          if (!(blob instanceof Blob) || blob.size < 300) return reject(new Error('The QR poster PDF could not be created.'));
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'Prime-Auto-Care-Google-Review-QR-A5.pdf';
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1500);
          resolve();
        });
      } catch (error) { reject(error); }
    });
  }
};
