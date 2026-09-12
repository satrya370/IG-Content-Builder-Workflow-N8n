function getRequiredImageFields(template, slide) {
  if (template === 'tips-content') return [];

  if (template === 'news-content') {
    if ((slide.type === 'intro' || slide.type === 'isi' || slide.type === 'closing') && slide.data?.IMAGE_URL) return ['IMAGE_URL'];
  }

  if (template === 'visual-content') {
    if (slide.type === 'intro' && slide.data?.IMAGE_3D_URL) return ['IMAGE_3D_URL'];
    if (slide.type === 'isi' && slide.data?.IMAGE_URL) return ['IMAGE_URL'];
  }

  return [];
}

async function validateRemoteImage(url, fetchImpl = fetch) {
  if (!url) {
    return { valid: false, reason: 'missing image URL' };
  }

  let response;
  try {
    response = await fetchImpl(url, { method: 'HEAD' });
  } catch {
    response = await fetchImpl(url);
  }

  if (!response || !response.ok) {
    return { valid: false, reason: 'image request failed' };
  }

  const contentType = response.headers?.get?.('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    return { valid: false, reason: `invalid content-type: ${contentType || 'unknown'}` };
  }

  return { valid: true, reason: '', contentType };
}

async function validatePlanImages(plan, fetchImpl = fetch) {
  const failures = [];

  for (const slide of plan.slides || []) {
    for (const field of getRequiredImageFields(plan.template, slide)) {
      const url = slide.data?.[field] || '';
      if (!url) {
        failures.push({ slideId: slide.id, field, reason: 'required image URL is empty' });
        continue;
      }

      const result = await validateRemoteImage(url, fetchImpl);
      if (!result.valid) {
        failures.push({ slideId: slide.id, field, reason: result.reason, url });
      }
    }
  }

  return {
    valid: failures.length === 0,
    failures,
  };
}

module.exports = {
  getRequiredImageFields,
  validateRemoteImage,
  validatePlanImages,
};
